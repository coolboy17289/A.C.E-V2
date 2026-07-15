/*
 * A.C.E OS — Common daemon utilities.
 *
 *   - signal handling (graceful shutdown on SIGTERM/SIGINT)
 *   - privilege drop (after bind, when the listen socket is on 127.0.0.1)
 *   - logging (single line per event, prefix-tagged)
 *   - env-var helpers
 */

#ifndef ACE_DAEMON_H
#define ACE_DAEMON_H

#include <stdarg.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* volatile flag flipped to 1 by the SIGTERM/SIGINT handler. Daemon
 * main loops should poll it and exit cleanly. */
extern volatile int ace_daemon_should_exit;

/* Install SIGTERM/SIGINT handlers that flip ace_daemon_should_exit.
 * Call once at the top of main(). */
void ace_daemon_install_signals(void);

/* Drop to the given uid/gid. Used after binding a privileged port so
 * the daemon can run unprivileged (matching systemd's ProtectSystem
 * posture). Returns 0 on success, -1 on failure. */
int ace_daemon_drop_privilege(const char *user);

/* Returns 1 if the named env var is set to a truthy value ("1", "true",
 * "yes", "on" — case-insensitive), 0 otherwise. Used for opt-in
 * features like ACE_ALLOW_POWER. */
int ace_daemon_env_bool(const char *name);

/* Returns the integer value of an env var, or `default_value` if
 * unset / unparseable. */
int ace_daemon_env_int(const char *name, int default_value);

/* Read an env var into `out` (size out_size). Returns the number of
 * bytes written (excluding NUL), or -1 if unset / too large. */
int ace_daemon_env_string(const char *name, char *out, size_t out_size);

/* Log a line to stderr in [tag] msg format. */
void ace_daemon_log(const char *tag, const char *fmt, ...);

#ifdef __cplusplus
}
#endif

#endif /* ACE_DAEMON_H */
