/*
 * A.C.E OS — Minimal HTTP server (implementation). See http.h.
 *
 * This is a toy HTTP server. It is not RFC-compliant, it does not
 * support keep-alive, and it does not handle chunked transfer
 * encoding. It is enough to take JSON POSTs over loopback.
 */

#include "http.h"

#include <arpa/inet.h>
#include <ctype.h>
#include <errno.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

#define ACE_HTTP_HEADER_MAX 8192
#define ACE_HTTP_BODY_MAX   16384

int ace_http_listen(const char *bind_addr, int port)
{
    int s = socket(AF_INET, SOCK_STREAM, 0);
    if (s < 0) return -1;
    int one = 1;
    setsockopt(s, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));

    struct sockaddr_in sa = {0};
    sa.sin_family = AF_INET;
    sa.sin_port   = htons((uint16_t)port);
    if (bind_addr && *bind_addr)
        inet_pton(AF_INET, bind_addr, &sa.sin_addr);
    else
        sa.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (bind(s, (struct sockaddr *)&sa, sizeof(sa)) < 0) {
        int saved = errno;
        close(s);
        errno = saved;
        return -1;
    }
    if (listen(s, 8) < 0) {
        int saved = errno;
        close(s);
        errno = saved;
        return -1;
    }
    return s;
}

/* Find a CRLFCRLF in [buf, buf+len). Returns offset or -1. */
static int find_header_end(const char *buf, size_t len)
{
    if (len < 4) return -1;
    for (size_t i = 0; i + 3 < len; i++) {
        if (buf[i] == '\r' && buf[i + 1] == '\n' &&
            buf[i + 2] == '\r' && buf[i + 3] == '\n') {
            return (int)i;
        }
    }
    return -1;
}

int ace_http_read_request(int fd, ace_http_req_t *out)
{
    if (!out) return -1;
    memset(out, 0, sizeof(*out));

    char *header = malloc(ACE_HTTP_HEADER_MAX);
    if (!header) return -1;
    size_t header_len = 0;

    /* Read until we see the end of headers, with a hard cap. */
    ssize_t n;
    int end_at = -1;
    while (header_len < ACE_HTTP_HEADER_MAX &&
           (end_at = find_header_end(header, header_len)) < 0) {
        n = read(fd, header + header_len, ACE_HTTP_HEADER_MAX - header_len);
        if (n <= 0) { free(header); return -1; }
        header_len += (size_t)n;
    }
    if (end_at < 0) { free(header); return -1; }

    /* Parse the request line. We only support "METHOD SP PATH SP HTTP/1.x". */
    char *line_end = memchr(header, '\r', (size_t)end_at);
    if (!line_end) { free(header); return -1; }
    *line_end = '\0';

    char *sp1 = strchr(header, ' ');
    if (!sp1) { free(header); return -1; }
    *sp1 = '\0';
    out->method = header;

    char *path = sp1 + 1;
    char *sp2 = strchr(path, ' ');
    if (!sp2) { free(header); return -1; }
    *sp2 = '\0';
    out->path = path;

    /* Content-Length: parse from header lines. */
    size_t content_length = 0;
    char *p = line_end + 2; /* skip CRLF */
    while (p < header + end_at) {
        char *eol = memchr(p, '\r', header + end_at - p);
        if (!eol) break;
        if (eol == p) { p = eol + 2; continue; }
        *eol = '\0';
        if (strncasecmp(p, "Content-Length:", 15) == 0) {
            content_length = (size_t)strtoul(p + 15, NULL, 10);
        }
        *eol = '\r';
        p = eol + 2;
    }

    if (content_length > ACE_HTTP_BODY_MAX) {
        free(header);
        return -1;
    }
    if (content_length > 0) {
        out->body = malloc(content_length + 1);
        if (!out->body) { free(header); return -1; }
        /* We've already consumed up to end_at+4. Read the rest from fd. */
        size_t already = header_len - (size_t)(end_at + 4);
        size_t to_read = content_length;
        if (already > 0) {
            if (already > to_read) already = to_read;
            memcpy(out->body, header + end_at + 4, already);
            to_read -= already;
        }
        out->body_len = content_length;
        out->body[content_length] = '\0';
        while (to_read > 0) {
            n = read(fd, out->body + (content_length - to_read), to_read);
            if (n <= 0) { free(out->body); free(header); return -1; }
            to_read -= (size_t)n;
        }
    } else {
        out->body = malloc(1);
        if (!out->body) { free(header); return -1; }
        out->body[0] = '\0';
        out->body_len = 0;
    }
    free(header);
    return 0;
}

void ace_http_free_request(ace_http_req_t *req)
{
    if (!req) return;
    free(req->body);
    req->body = NULL;
    req->body_len = 0;
}

static const char *status_text(int status)
{
    switch (status) {
        case 200: return "OK";
        case 201: return "Created";
        case 400: return "Bad Request";
        case 404: return "Not Found";
        case 405: return "Method Not Allowed";
        case 500: return "Internal Server Error";
        default:  return "OK";
    }
}

void ace_http_write_response(int fd, const ace_http_resp_t *resp)
{
    char head[256];
    int  hl = snprintf(head, sizeof(head),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: %zu\r\n"
        "Connection: close\r\n"
        "\r\n",
        resp->status, status_text(resp->status),
        strlen(resp->body));
    if (hl > 0) (void)!write(fd, head, (size_t)hl);
    (void)!write(fd, resp->body, strlen(resp->body));
}

/* ------------------------------------------------------------------ */
/* Tiny JSON reader                                                    */
/* ------------------------------------------------------------------ */

static const char *find_key(const char *body, size_t len, const char *key)
{
    size_t klen = strlen(key);
    if (len < klen + 5) return NULL;
    for (size_t i = 0; i + klen + 2 < len; i++) {
        if (body[i] != '"') continue;
        if (memcmp(body + i + 1, key, klen) != 0) continue;
        if (body[i + 1 + klen] != '"') continue;
        const char *p = body + i + 1 + klen + 1;
        while (p < body + len && (*p == ' ' || *p == '\t')) p++;
        if (p >= body + len || *p != ':') continue;
        p++;
        while (p < body + len && (*p == ' ' || *p == '\t')) p++;
        return p;
    }
    return NULL;
}

int ace_http_json_get_string(const char *body, size_t len,
                             const char *key, char *out, size_t out_size)
{
    if (!body || !out || out_size == 0) return -1;
    const char *p = find_key(body, len, key);
    if (!p) return -1;
    const char *end = body + len;
    if (p >= end || *p != '"') return -1;
    p++;
    size_t i = 0;
    while (p < end && *p != '"') {
        if (*p == '\\' && p + 1 < end) p++;
        if (i + 1 >= out_size) return -1;
        out[i++] = *p++;
    }
    out[i] = '\0';
    return 0;
}

int ace_http_json_get_int(const char *body, size_t len, const char *key, int *out)
{
    if (!body || !out) return -1;
    const char *p = find_key(body, len, key);
    if (!p) return -1;
    const char *end = body + len;
    /* Skip leading whitespace. */
    while (p < end && (*p == ' ' || *p == '\t')) p++;
    if (p >= end) return -1;
    /* Optional minus sign. */
    int neg = 0;
    if (*p == '-') { neg = 1; p++; }
    if (p >= end || !isdigit((unsigned char)*p)) return -1;
    long v = 0;
    while (p < end && isdigit((unsigned char)*p)) {
        v = v * 10 + (*p - '0');
        if (v > 1000000000L) return -1;
        p++;
    }
    *out = (int)(neg ? -v : v);
    return 0;
}

int ace_http_json_get_bool(const char *body, size_t len, const char *key, int *out)
{
    if (!body || !out) return -1;
    const char *p = find_key(body, len, key);
    if (!p) return -1;
    const char *end = body + len;
    while (p < end && (*p == ' ' || *p == '\t')) p++;
    if (end - p >= 4 && memcmp(p, "true", 4) == 0)  { *out = 1; return 0; }
    if (end - p >= 5 && memcmp(p, "false", 5) == 0) { *out = 0; return 0; }
    return -1;
}
