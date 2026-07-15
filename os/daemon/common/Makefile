# Common daemon utilities used by every A.C.E OS C daemon.
#
# Builds libacedcommon.a (the static form of http.c + daemon.c) and a
# test driver that exercises both via a loopback HTTP round-trip and
# unit-tests the env helpers.
#
# Other daemons (hardware, system, focus) depend on this library and
# include its headers via -I../common.

CC      ?= cc
CFLAGS  ?= -std=c11 -O2 -Wall -Wextra -Wpedantic -fPIC -D_GNU_SOURCE
AR      ?= ar
ARFLAGS  = rcs

LIB     = libacedcommon.a
SRCS    = http.c daemon.c
OBJS    = http.o daemon.o
HEADERS = http.h daemon.h

TEST_BIN = test_common
TEST_SRCS = test_common.c

.PHONY: all test clean

all: $(LIB) $(TEST_BIN)

$(LIB): $(OBJS)
	$(AR) $(ARFLAGS) $@ $^

http.o: http.c $(HEADERS)
	$(CC) $(CFLAGS) -c $< -o $@

daemon.o: daemon.c $(HEADERS)
	$(CC) $(CFLAGS) -c $< -o $@

$(TEST_BIN): $(TEST_SRCS) $(OBJS) $(HEADERS)
	$(CC) $(CFLAGS) $(TEST_SRCS) $(OBJS) -o $@

test: $(TEST_BIN)
	./$(TEST_BIN)

clean:
	rm -f $(OBJS) $(LIB) $(TEST_BIN)
