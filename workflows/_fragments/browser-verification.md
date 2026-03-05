## Browser Verification (OPTIONAL — use when dev server is running)
After writing code, verify your changes visually:
1. If dev server is running, use browser to check:
   ```bash
   export AGENT_BROWSER_SESSION="{{current_story_id}}-impl"
   export AGENT_BROWSER_CONTENT_BOUNDARIES=1
   agent-browser open http://localhost:$(cat .dev-port 2>/dev/null || echo 3000)
   agent-browser wait --load networkidle
   agent-browser snapshot -i
   ```
2. Check if all buttons have handlers, all links route correctly
3. If issues found, fix and re-verify
4. Always close: `agent-browser close`
