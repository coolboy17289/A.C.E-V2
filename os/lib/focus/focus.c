/*
 * A.C.E OS — Focus timer state machine (implementation)
 *
 * See focus.h for the contract. This file is intentionally tiny and free
 * of libc features beyond <string.h>; the kernel-side daemon we'll
 * eventually link this from can swap in lighter replacements.
 */

#include "focus.h"

#include <string.h>

void ace_focus_init(ace_focus_t *f, int work_minutes, int break_minutes)
{
    if (!f) return;
    /* Clamp to >= 1 so callers can't pass 0 and crash on division / loops. */
    if (work_minutes  < 1) work_minutes  = 1;
    if (break_minutes < 1) break_minutes = 1;

    memset(f, 0, sizeof(*f));
    f->work_minutes  = work_minutes;
    f->break_minutes = break_minutes;
    f->state         = ACE_FOCUS_IDLE;
    f->total_seconds = work_minutes * 60;
    f->seconds_left  = f->total_seconds;
    f->running       = 0;
    f->cycle         = 0;
}

void ace_focus_reset(ace_focus_t *f)
{
    if (!f) return;
    f->state         = ACE_FOCUS_IDLE;
    f->total_seconds = f->work_minutes * 60;
    f->seconds_left  = f->total_seconds;
    f->running       = 0;
    /* cycle is intentionally preserved so "blocks completed this session"
     * stays correct across resets. Callers that want a true zero can
     * write 0 to f->cycle themselves. */
}

void ace_focus_start(ace_focus_t *f)
{
    if (!f) return;
    if (f->state == ACE_FOCUS_IDLE) {
        f->state         = ACE_FOCUS_WORK;
        f->total_seconds = f->work_minutes * 60;
        f->seconds_left  = f->total_seconds;
    } else if (f->state == ACE_FOCUS_DONE) {
        /* A finished block re-arms fresh work. */
        f->state         = ACE_FOCUS_WORK;
        f->total_seconds = f->work_minutes * 60;
        f->seconds_left  = f->total_seconds;
    }
    /* WORK / BREAK: keep the current phase's remaining time. */
    f->running = 1;
}

void ace_focus_pause(ace_focus_t *f)
{
    if (!f) return;
    f->running = 0;
}

int ace_focus_tick(ace_focus_t *f)
{
    if (!f) return 0;
    if (!f->running) return 0;
    if (f->state != ACE_FOCUS_WORK && f->state != ACE_FOCUS_BREAK) return 0;
    if (f->seconds_left > 0) f->seconds_left--;

    if (f->seconds_left > 0) return 0;

    /* Phase boundary. */
    if (f->state == ACE_FOCUS_WORK) {
        f->cycle++;
        f->state         = ACE_FOCUS_BREAK;
        f->total_seconds = f->break_minutes * 60;
        f->seconds_left  = f->total_seconds;
        return 1;
    }

    /* BREAK just ended. */
    f->state         = ACE_FOCUS_DONE;
    f->total_seconds = 0;
    f->seconds_left  = 0;
    f->running       = 0;
    return 1;
}

int ace_focus_ratio_x1000(const ace_focus_t *f)
{
    if (!f) return 0;
    if (f->total_seconds <= 0) return 0;
    if (!f->running) return 0;
    int elapsed = f->total_seconds - f->seconds_left;
    if (elapsed < 0) elapsed = 0;
    /* (elapsed * 1000) / total — integer math, 0..1000. */
    return (elapsed * 1000) / f->total_seconds;
}

const char *ace_focus_state_name(ace_focus_state_t s)
{
    switch (s) {
        case ACE_FOCUS_IDLE:  return "idle";
        case ACE_FOCUS_WORK:  return "work";
        case ACE_FOCUS_BREAK: return "break";
        case ACE_FOCUS_DONE:  return "done";
    }
    return "unknown";
}
