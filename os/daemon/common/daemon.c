/*
 * A.C.E OS — Common daemon utilities (implementation).
 */

#include "daemon.h"

#include <ctype.h>
#include <pwd.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <unistd.h>

volatile int ace_daemon_should_exit = 0;

static void on_signal(int sig)
{
    (void)sig;
    ace_daemon_should_exit = 1;
}

void ace_daemon_install_signals(void)
{
    struct sigaction sa = {0};
    sa.sa_handler = on_signal;
    sigemptyset(&sa.sa_mask);
    sigaction(SIGTERM, &sa, NULL);
    sigaction(SIGINT,  &sa, NULL);

    /* SIGPIPE arrives when a client disconnects mid-write. We don't
     * want to die; we just want the read() / write() to fail and let
     * the per-connection handler bail. */
    struct sigaction sp = {0};
    sp.sa_handler = SIG_IGN;
    sigemptyset(&sp.sa_mask);
    sigaction(SIGPIPE, &sp, NULL);
}

int ace_daemon_drop_privilege(const char *user)
{
    if (!user || !*user) return 0;
    struct passwd *pw = getpwnam(user);
    if (!pw) return -1;
    if (setgid(pw->pw_gid) != 0) return -1;
    if (setuid(pw->pw_uid) != 0) return -1;
    return 0;
}

int ace_daemon_env_bool(const char *name)
{
    const char *v = getenv(name);
    if (!v) return 0;
    while (*v == ' ' || *v == '\t') v++;
    if (!*v) return 0;
    return (v[0] == '1' ||
            tolower((unsigned char)v[0]) == 't' ||
            tolower((unsigned char)v[0]) == 'y');
}

int ace_daemon_env_int(const char *name, int default_value)
{
    const char *v = getenv(name);
    if (!v) return default_value;
    char *end = NULL;
    long n = strtol(v, &end, 10);
    if (end == v) return default_value;
    return (int)n;
}

int ace_daemon_env_string(const char *name, char *out, size_t out_size)
{
    if (out_size == 0) return -1;
    const char *v = getenv(name);
    if (!v) { out[0] = '\0'; return -1; }
    size_t n = strlen(v);
    if (n + 1 > out_size) { out[0] = '\0'; return -1; }
    memcpy(out, v, n + 1);
    return (int)n;
}

void ace_daemon_log(const char *tag, const char *fmt, ...)
{
    fprintf(stderr, "[%s] ", tag ? tag : "aced");
    va_list ap;
    va_start(ap, fmt);
    vfprintf(stderr, fmt, ap);
    va_end(ap);
    fputc('\n', stderr);
    fflush(stderr);
}
