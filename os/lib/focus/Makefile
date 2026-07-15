# A.C.E OS — Focus timer state machine
#
# Builds libfocus.a (the static library form of focus.c) and a standalone
# test driver test_focus. Designed to build cleanly with -Wall -Wextra
# and no libc features beyond <string.h>.
#
# Usage:
#     make            # build libfocus.a + test_focus
#     make test       # build and run the test driver
#     make clean      # remove build artifacts
#
# A future kernel-side daemon can link against libfocus.a by adding this
# directory to its build system; the public API is the focus.h header.

CC      ?= cc
CFLAGS  ?= -std=c11 -O2 -Wall -Wextra -Wpedantic -fPIC
AR      ?= ar
ARFLAGS  = rcs

LIB     = libfocus.a
SRCS    = focus.c
OBJS    = focus.o
HEADERS = focus.h

TEST_BIN = test_focus
TEST_SRCS = test_focus.c

.PHONY: all test clean

all: $(LIB) $(TEST_BIN)

$(LIB): $(OBJS)
	$(AR) $(ARFLAGS) $@ $^

focus.o: focus.c $(HEADERS)
	$(CC) $(CFLAGS) -c $< -o $@

$(TEST_BIN): $(TEST_SRCS) $(OBJS) $(HEADERS)
	$(CC) $(CFLAGS) $(TEST_SRCS) $(OBJS) -o $@

test: $(TEST_BIN)
	./$(TEST_BIN)

clean:
	rm -f $(OBJS) $(LIB) $(TEST_BIN)
