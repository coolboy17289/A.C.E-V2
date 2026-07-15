/*
 * A.C.E OS — Minimal HTTP/1.1 request reader + JSON responder.
 *
 * Deliberately small: the daemons in os/daemon/ only ever need to:
 *   - accept a single request
 *   - parse the method, path, and a tiny JSON body
 *   - run a route handler
 *   - write back a JSON response with the right status code
 *
 * This is a fork-per-connection server, single-threaded. It is *not*
 * a general-purpose HTTP server. It exists so the daemons don't have
 * to depend on libmicrohttpd, mongoose, or any third-party library.
 *
 * Public surface:
 *
 *   typedef struct {
 *       const char *method;   // "GET" / "POST" / ...
 *       const char *path;     // "/api/foo"
 *       const char *body;     // malloc'd request body (may be empty)
 *       size_t      body_len; // length of body
 *   } ace_http_req_t;
 *
 *   typedef struct {
 *       int   status;         // 200, 400, 404, 500
 *       char  body[8192];     // JSON body, NUL-terminated
 *   } ace_http_resp_t;
 *
 *   int  ace_http_listen(const char *bind_addr, int port);
 *   int  ace_http_read_request(int fd, ace_http_req_t *out);
 *   void ace_http_write_response(int fd, const ace_http_resp_t *resp);
 *   void ace_http_free_request(ace_http_req_t *req);
 *
 *   int  ace_http_json_get_string(const char *body, size_t len,
 *                                 const char *key, char *out, size_t out_size);
 *   int  ace_http_json_get_int(const char *body, size_t len,
 *                              const char *key, int *out);
 *
 * The JSON parser is intentionally line-by-line. It supports:
 *   {"key": "value", "key2": 42, "key3": true, "key3": null}
 * and that's it. It is enough for the daemons' wire protocol and
 * nothing more. A proper JSON library would be a maintenance burden
 * for a 100-byte surface area.
 */

#ifndef ACE_HTTP_H
#define ACE_HTTP_H

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    const char *method;
    const char *path;
    char       *body;        /* malloc'd, may be empty */
    size_t      body_len;
} ace_http_req_t;

typedef struct {
    int  status;
    char body[8192];
} ace_http_resp_t;

/* Open a listening TCP socket on (bind_addr, port). Returns fd >= 0 on
 * success, -1 on failure (with errno set). bind_addr=NULL means 127.0.0.1. */
int ace_http_listen(const char *bind_addr, int port);

/* Block until one full HTTP request is read from fd. Returns 0 on
 * success, -1 on EOF or protocol error. The caller must call
 * ace_http_free_request() on success. */
int ace_http_read_request(int fd, ace_http_req_t *out);

/* Free the body buffer inside the request. */
void ace_http_free_request(ace_http_req_t *req);

/* Send a response. The body is JSON; status codes >=400 get a small
 * status-line note (the body itself is sent verbatim). */
void ace_http_write_response(int fd, const ace_http_resp_t *resp);

/* Tiny JSON value getters. Return 0 on success, -1 if the key is
 * missing or the value can't be parsed into the requested shape.
 *
 * For strings: `out` is NUL-terminated. A present-but-empty value
 * becomes an empty string. A missing key returns -1.
 *
 * For ints: rejects floats, exponents, and out-of-range values.
 */
int ace_http_json_get_string(const char *body, size_t len,
                             const char *key, char *out, size_t out_size);
int ace_http_json_get_int(const char *body, size_t len,
                          const char *key, int *out);
int ace_http_json_get_bool(const char *body, size_t len,
                           const char *key, int *out);

#ifdef __cplusplus
}
#endif

#endif /* ACE_HTTP_H */
