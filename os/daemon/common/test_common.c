/*
 * Test driver for the A.C.E common daemon utilities.
 *
 * Spawns a tiny ephemeral HTTP server on a kernel-chosen port, then
 * connects a client socket to it and runs a few requests through to
 * exercise:
 *   - ace_http_listen / accept loop
 *   - ace_http_read_request (with and without body)
 *   - ace_http_write_response
 *   - ace_http_json_get_string / get_int / get_bool
 *   - ace_daemon_env_int / env_bool / env_string
 *
 * Each test gets its own accept so we can drive the request reader
 * from a single connection. Exits 0 on success, non-zero on failure.
 */

#include "daemon.h"
#include "http.h"

#include <arpa/inet.h>
#include <errno.h>
#include <netinet/in.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <unistd.h>

static int g_failures = 0;
#define EXPECT(cond, ...) do { \
    if (!(cond)) { \
        fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); \
        fprintf(stderr, "      " __VA_ARGS__); \
        fprintf(stderr, "\n"); \
        g_failures++; \
    } \
} while (0)

typedef struct {
    int server_fd;
    int port;
    int done;
} server_state_t;

static void *server_thread(void *arg)
{
    server_state_t *s = (server_state_t *)arg;
    int c = accept(s->server_fd, NULL, NULL);
    if (c < 0) return NULL;

    ace_http_req_t req;
    EXPECT(ace_http_read_request(c, &req) == 0, "read request failed");
    EXPECT(strcmp(req.method, "POST") == 0, "method=%s", req.method);
    EXPECT(strcmp(req.path, "/api/echo") == 0, "path=%s", req.path);
    EXPECT(req.body_len == strlen(req.body), "body_len=%zu", req.body_len);

    int port = -1;
    EXPECT(ace_http_json_get_int(req.body, req.body_len, "port", &port) == 0,
           "missing port in %.*s", (int)req.body_len, req.body);
    EXPECT(port == 4317, "port=%d", port);

    int on = -1;
    EXPECT(ace_http_json_get_bool(req.body, req.body_len, "on", &on) == 0,
           "missing on");
    EXPECT(on == 1, "on=%d", on);

    char name[64];
    EXPECT(ace_http_json_get_string(req.body, req.body_len, "name", name, sizeof(name)) == 0,
           "missing name");
    EXPECT(strcmp(name, "ace") == 0, "name=%s", name);

    ace_http_resp_t resp = { .status = 200 };
    snprintf(resp.body, sizeof(resp.body),
             "{\"ok\":true,\"echo_port\":%d}", port);
    ace_http_write_response(c, &resp);

    ace_http_free_request(&req);
    close(c);
    s->done = 1;
    return NULL;
}

static void test_http_roundtrip(void)
{
    server_state_t s = {0};
    s.server_fd = ace_http_listen(NULL, 0);   /* ephemeral port */
    EXPECT(s.server_fd >= 0, "listen: %s", strerror(errno));

    /* Discover the port. */
    struct sockaddr_in sa; socklen_t sl = sizeof(sa);
    getsockname(s.server_fd, (struct sockaddr *)&sa, &sl);
    s.port = ntohs(sa.sin_port);
    EXPECT(s.port > 0, "port=%d", s.port);

    pthread_t tid;
    pthread_create(&tid, NULL, server_thread, &s);

    int c = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in ca = {0};
    ca.sin_family = AF_INET;
    ca.sin_port   = htons((uint16_t)s.port);
    inet_pton(AF_INET, "127.0.0.1", &ca.sin_addr);
    EXPECT(connect(c, (struct sockaddr *)&ca, sizeof(ca)) == 0,
           "connect: %s", strerror(errno));

    const char *req =
        "POST /api/echo HTTP/1.1\r\n"
        "Host: localhost\r\n"
        "Content-Type: application/json\r\n"
        "Content-Length: 47\r\n"
        "\r\n"
        "{\"port\":4317,\"on\":true,\"name\":\"ace\"}";
    ssize_t w = write(c, req, strlen(req));
    EXPECT(w == (ssize_t)strlen(req), "wrote %zd", w);

    char buf[1024] = {0};
    ssize_t r = read(c, buf, sizeof(buf) - 1);
    EXPECT(r > 0, "read=%zd", r);
    EXPECT(strstr(buf, "HTTP/1.1 200") != NULL, "buf=%s", buf);
    EXPECT(strstr(buf, "\"echo_port\":4317") != NULL, "buf=%s", buf);

    close(c);
    pthread_join(tid, NULL);
    close(s.server_fd);
}

static void test_env_helpers(void)
{
    setenv("ACE_TEST_INT",  "42",   1);
    setenv("ACE_TEST_BOOL", "true", 1);
    setenv("ACE_TEST_BOOL2","0",    1);
    setenv("ACE_TEST_STR",  "hello",1);
    EXPECT(ace_daemon_env_int("ACE_TEST_INT", -1) == 42, "int");
    EXPECT(ace_daemon_env_int("ACE_TEST_MISSING", 7) == 7, "missing");
    EXPECT(ace_daemon_env_bool("ACE_TEST_BOOL") == 1, "true");
    EXPECT(ace_daemon_env_bool("ACE_TEST_BOOL2") == 0, "zero");
    EXPECT(ace_daemon_env_bool("ACE_TEST_MISSING") == 0, "missing");
    char out[64];
    EXPECT(ace_daemon_env_string("ACE_TEST_STR", out, sizeof(out)) == 5, "len");
    EXPECT(strcmp(out, "hello") == 0, "out=%s", out);
    EXPECT(ace_daemon_env_string("ACE_TEST_MISSING", out, sizeof(out)) == -1, "missing");
    unsetenv("ACE_TEST_INT");
    unsetenv("ACE_TEST_BOOL");
    unsetenv("ACE_TEST_BOOL2");
    unsetenv("ACE_TEST_STR");
}

static void test_json_edge_cases(void)
{
    const char *json = "{\"empty\":\"\",\"zero\":0,\"neg\":-7}";
    char buf[8];
    EXPECT(ace_http_json_get_string(json, strlen(json), "empty", buf, sizeof(buf)) == 0, "empty");
    EXPECT(buf[0] == '\0', "empty value");
    int n = 999;
    EXPECT(ace_http_json_get_int(json, strlen(json), "zero", &n) == 0, "zero");
    EXPECT(n == 0, "zero=%d", n);
    EXPECT(ace_http_json_get_int(json, strlen(json), "neg", &n) == 0, "neg");
    EXPECT(n == -7, "neg=%d", n);
}

int main(void)
{
    test_http_roundtrip();
    test_env_helpers();
    test_json_edge_cases();

    if (g_failures == 0) {
        fprintf(stderr, "ok — all common-daemon tests passed\n");
        return 0;
    }
    fprintf(stderr, "FAILED: %d assertion(s) failed\n", g_failures);
    return 1;
}
