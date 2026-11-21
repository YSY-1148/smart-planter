/* Only the three byte-memory operations used by the unchanged controller. */
#include <stddef.h>
#include <stdint.h>
void *memcpy(void *dest, const void *src, size_t n) {
    volatile unsigned char *d=dest; const volatile unsigned char *s=src;
    for (size_t i=0;i<n;i++) d[i]=s[i];
    return dest;
}
void *memmove(void *dest, const void *src, size_t n) {
    volatile unsigned char *d=dest; const volatile unsigned char *s=src;
    if ((uintptr_t)d<(uintptr_t)s) for (size_t i=0;i<n;i++) d[i]=s[i];
    else for (size_t i=n;i>0;i--) d[i-1]=s[i-1];
    return dest;
}
void *memset(void *dest, int value, size_t n) {
    volatile unsigned char *d=dest;
    for (size_t i=0;i<n;i++) d[i]=(unsigned char)value;
    return dest;
}
static int64_t scratch[128];
void *lab_buffer(void) { return scratch; }
