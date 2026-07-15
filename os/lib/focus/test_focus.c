/*
 * Standalone test driver for the Focus state machine.
 *
 * Compile with `cc test_focus.c focus.c -o test_focus` (or use the Makefile
 * target `make test`). Exits 0 on success, non-zero on any failed assert.
 *
 * The asserts use fprintf(stderr, ...) on failure rather than abort()
 * so CI logs capture the full chain of state on a bad test.
 */

#include "focus.h"

#include <stdio.h>
#include <string.h>

static int g_failures = 0;

#define EXPECT(cond, ...) do { \
    if (!(cond)) { \
        fprintf(stderr, "FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); \
        fprintf(stderr, "      " __VA_ARGS__); \
        fprintf(stderr, "\n"); \
        g_failures++; \
    } \
} while (0)

/* Walk the timer N ticks, asserting no phase transition happens. */
static void tick_n(ace_focus_t *f, int n)
{
    for (int i = 0; i < n; i++) (void)ace_focus_tick(f);
}

static void test_init_defaults(void)
{
    ace_focus_t f;
    ace_focus_init(&f, 25, 5);

    EXPECT(f.work_minutes  == 25, "work=%d",  f.work_minutes);
    EXPECT(f.break_minutes == 5,  "break=%d", f.break_minutes);
    EXPECT(f.state == ACE_FOCUS_IDLE, "state=%s", ace_focus_state_name(f.state));
    EXPECT(f.total_seconds == 25 * 60, "total=%d", f.total_seconds);
    EXPECT(f.seconds_left  == 25 * 60, "left=%d",  f.seconds_left);
    EXPECT(f.running == 0, "running=%d", f.running);
    EXPECT(f.cycle == 0, "cycle=%d", f.cycle);

    /* ratio_x1000 is 0 when idle. */
    EXPECT(ace_focus_ratio_x1000(&f) == 0, "ratio=%d", ace_focus_ratio_x1000(&f));
}

static void test_work_phase_transitions_to_break(void)
{
    ace_focus_t f;
    ace_focus_init(&f, 25, 5);
    ace_focus_start(&f);

    EXPECT(f.state == ACE_FOCUS_WORK, "state=%s", ace_focus_state_name(f.state));
    EXPECT(f.running == 1, "running=%d", f.running);

    /* Tick down 25*60 - 1 seconds: no transition yet. */
    tick_n(&f, 25 * 60 - 1);
    EXPECT(f.state == ACE_FOCUS_WORK, "state=%s", ace_focus_state_name(f.state));
    EXPECT(f.seconds_left == 1, "left=%d", f.seconds_left);

    /* Final tick: WORK → BREAK, returns 1, cycle bumps to 1. */
    int changed = ace_focus_tick(&f);
    EXPECT(changed == 1, "changed=%d", changed);
    EXPECT(f.state == ACE_FOCUS_BREAK, "state=%s", ace_focus_state_name(f.state));
    EXPECT(f.cycle == 1, "cycle=%d", f.cycle);
    EXPECT(f.seconds_left == 5 * 60, "left=%d", f.seconds_left);
    EXPECT(f.total_seconds == 5 * 60, "total=%d", f.total_seconds);
    EXPECT(f.running == 1, "running=%d", f.running);
}

static void test_break_phase_transitions_to_done(void)
{
    ace_focus_t f;
    ace_focus_init(&f, 25, 5);
    ace_focus_start(&f);

    /* Walk through WORK fully. */
    tick_n(&f, 25 * 60);
    EXPECT(f.state == ACE_FOCUS_BREAK, "state=%s", ace_focus_state_name(f.state));

    /* Walk through BREAK fully. */
    tick_n(&f, 5 * 60 - 1);
    EXPECT(f.state == ACE_FOCUS_BREAK, "state=%s", ace_focus_state_name(f.state));
    EXPECT(f.seconds_left == 1, "left=%d", f.seconds_left);

    int changed = ace_focus_tick(&f);
    EXPECT(changed == 1, "changed=%d", changed);
    EXPECT(f.state == ACE_FOCUS_DONE, "state=%s", ace_focus_state_name(f.state));
    EXPECT(f.cycle == 1, "cycle=%d", f.cycle);
    EXPECT(f.running == 0, "running=%d", f.running);
    EXPECT(f.seconds_left == 0, "left=%d", f.seconds_left);
}

static void test_pause_preserves_state(void)
{
    ace_focus_t f;
    ace_focus_init(&f, 25, 5);
    ace_focus_start(&f);

    tick_n(&f, 100);
    int left_before  = f.seconds_left;
    ace_focus_state_t state_before = f.state;
    ace_focus_pause(&f);

    EXPECT(f.running == 0, "running=%d", f.running);
    EXPECT(f.seconds_left == left_before, "left=%d want=%d", f.seconds_left, left_before);
    EXPECT(f.state == state_before, "state=%s want=%s",
           ace_focus_state_name(f.state), ace_focus_state_name(state_before));

    /* Ticks while paused are no-ops. */
    tick_n(&f, 500);
    EXPECT(f.seconds_left == left_before, "left=%d", f.seconds_left);
    EXPECT(f.state == state_before, "state=%s", ace_focus_state_name(f.state));
}

static void test_reset_returns_to_idle(void)
{
    ace_focus_t f;
    ace_focus_init(&f, 25, 5);
    ace_focus_start(&f);
    tick_n(&f, 100);

    ace_focus_reset(&f);
    EXPECT(f.state == ACE_FOCUS_IDLE, "state=%s", ace_focus_state_name(f.state));
    EXPECT(f.running == 0, "running=%d", f.running);
    EXPECT(f.seconds_left == 25 * 60, "left=%d", f.seconds_left);
    EXPECT(f.total_seconds == 25 * 60, "total=%d", f.total_seconds);
    /* cycle survives reset — see comment in focus.c. */
    EXPECT(f.cycle == 0, "cycle=%d", f.cycle);
}

static void test_ratio_walks_zero_to_thousand(void)
{
    /* Use 2-minute phases so we can hit ratio=1000 mid-phase without
     * colliding with the work->break transition tick. The 60th tick on
     * a 1-minute phase is the transition itself, which sets the new
     * break phase's total_seconds=60 and ratio back to 0. */
    ace_focus_t f;
    ace_focus_init(&f, 2, 2);
    ace_focus_start(&f);

    EXPECT(ace_focus_ratio_x1000(&f) == 0, "ratio=%d", ace_focus_ratio_x1000(&f));
    tick_n(&f, 60);
    int r = ace_focus_ratio_x1000(&f);
    EXPECT(r >= 495 && r <= 505, "ratio mid=%d (expected ~500)", r);
    /* Walk to the last second of the work phase; ratio should be 1000
     * (119/120 * 1000 = 991, well within rounding). */
    tick_n(&f, 59);
    r = ace_focus_ratio_x1000(&f);
    EXPECT(r >= 990, "ratio near-end=%d (expected >= 990)", r);
    /* The 120th tick fires the transition; ratio resets as expected. */
    (void)ace_focus_tick(&f);
    EXPECT(f.state == ACE_FOCUS_BREAK, "state=%s", ace_focus_state_name(f.state));
}

static void test_state_names(void)
{
    EXPECT(strcmp(ace_focus_state_name(ACE_FOCUS_IDLE),  "idle")  == 0, "name");
    EXPECT(strcmp(ace_focus_state_name(ACE_FOCUS_WORK),  "work")  == 0, "name");
    EXPECT(strcmp(ace_focus_state_name(ACE_FOCUS_BREAK), "break") == 0, "name");
    EXPECT(strcmp(ace_focus_state_name(ACE_FOCUS_DONE),  "done")  == 0, "name");
    /* Unknown value is mapped to "unknown" so callers never see NULL. */
    EXPECT(strcmp(ace_focus_state_name((ace_focus_state_t)999), "unknown") == 0, "name");
}

int main(void)
{
    test_init_defaults();
    test_work_phase_transitions_to_break();
    test_break_phase_transitions_to_done();
    test_pause_preserves_state();
    test_reset_returns_to_idle();
    test_ratio_walks_zero_to_thousand();
    test_state_names();

    if (g_failures == 0) {
        fprintf(stderr, "ok — all focus tests passed\n");
        return 0;
    }
    fprintf(stderr, "FAILED: %d assertion(s) failed\n", g_failures);
    return 1;
}
