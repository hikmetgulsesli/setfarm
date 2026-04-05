PLATFORM-SPECIFIC DESIGN RULES:

WEB (WCAG 2.1 AA):
- All images need alt text, icon buttons need aria-label
- Color contrast minimum 4.5:1 for text
- Keyboard navigation: all interactive elements reachable via Tab
- focus-visible styles on interactive elements
- Responsive breakpoints: 375/768/1024/1440px

REACT NATIVE / MOBILE:
- Use View/Text/Pressable — NOT div/span/button
- Minimum touch target: 44x44pt (iOS) / 48x48dp (Android)
- SafeAreaView wrapper for all screens
- Use StyleSheet.create — NOT inline styles or web CSS
