/*
 * A.C.E OS — Focus timer state machine
 *
 * Pure, dependency-free C. Models the same work → break → idle transitions
 * the React Focus app does in JavaScript so the same logic can run inside
 * a future native Pi daemon without dragging a web view along.
 *
 * Ownership of the wall-clock tick stays with the caller. ace_focus_tick
 * only mutates state; it does not call sleep(), timers, or syscalls.
 *
 * Usage:
 *     ace_focus_t f;
 *     ace_focus_init(&f, 25, 5);     // 25-min work / 5-min break (Pomodoro)
 *     ace_focus_start(&f);
 *     while (running) {
 *         sleep(1);
 *         if (ace_focus_tick(&f)) {  // 1 = phase transition just happened
 *             log_phase_change(ace_focus_state_name(f.state));
 *         }
 *     }
 *
 * Thread-safety: not thread-safe. Treat the struct as caller-owned state.
 */

#ifndef ACE_FOCUS_H
#define ACE_FOCUS_H

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    ACE_FOCUS_IDLE  = 0,  /* not running, fresh block armed                */
    ACE_FOCUS_WORK  = 1,  /* counting down a work phase                   */
    ACE_FOCUS_BREAK = 2,  /* counting down a break phase                  */
    ACE_FOCUS_DONE  = 3   /* break finished, block complete, awaiting reset */
} ace_focus_state_t;

typedef struct {
    int work_minutes;        /* configured work-phase length in minutes       */
    int break_minutes;       /* configured break-phase length in minutes      */
    int seconds_left;        /* seconds remaining in the current phase        */
    int total_seconds;       /* seconds total in the current phase (for ratio)*/
    ace_focus_state_t state; /* current state                                 */
    int running;             /* 1 if a phase is in flight, 0 if paused/idle   */
    int cycle;               /* number of completed work phases since reset   */
} ace_focus_t;

/* Initialise the struct. Resets to IDLE with seconds_left = work_minutes * 60.
 * work_minutes and break_minutes must both be > 0; the function clamps to 1
 * to avoid div-by-zero in ratio and infinite-tick loops.
 */
void ace_focus_init(ace_focus_t *f, int work_minutes, int break_minutes);

/* Restore IDLE state and re-arm work phase. Safe to call from any state. */
void ace_focus_reset(ace_focus_t *f);

/* Start (or resume) the current phase. IDLE → WORK, WORK/BREAK stay put. */
void ace_focus_start(ace_focus_t *f);

/* Pause. The phase and remaining seconds are preserved. */
void ace_focus_pause(ace_focus_t *f);

/* Decrement seconds_left by one. Returns 1 if a phase transition just
 * happened (work→break, break→done), 0 otherwise. Caller is expected to
 * call this once per wall-clock second.
 *
 * On the tick that ends WORK, the function:
 *   - bumps `cycle`
 *   - transitions to BREAK
 *   - refills seconds_left with break_minutes * 60
 *
 * On the tick that ends BREAK, the function:
 *   - transitions to DONE
 *   - pauses (running = 0)
 *   - leaves seconds_left at 0
 */
int ace_focus_tick(ace_focus_t *f);

/* Progress through the current phase as an integer 0..1000.
 * Multiply by 0.001 to get a 0..1 float for the SVG ring.
 * Returns 0 when the timer is paused/idle (no phase in flight).
 */
int ace_focus_ratio_x1000(const ace_focus_t *f);

/* Human-readable name for a state value. Never returns NULL. */
const char *ace_focus_state_name(ace_focus_state_t s);

#ifdef __cplusplus
}
#endif

#endif /* ACE_FOCUS_H */
