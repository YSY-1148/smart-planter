#ifndef LAB_FREESTANDING_STRING_H
#define LAB_FREESTANDING_STRING_H
#include <stddef.h>
void *memcpy(void *dest, const void *src, size_t n);
void *memmove(void *dest, const void *src, size_t n);
void *memset(void *dest, int value, size_t n);
#endif
