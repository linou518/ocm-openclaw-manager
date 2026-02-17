#!/usr/bin/env python3
"""Update dashboard HTML to show Claude.ai usage bars."""

content = open('/home/linou/.openclaw/dashboard/index.html').read()

# 1. Add CSS for claude usage bars
css_add = """
  .claude-usage-widget { display:inline-flex; align-items:center; gap:6px; background:var(--card); border:1px solid var(--border); border-radius:8px; padding:3px 10px; font-size:10px; }
  .claude-usage-widget .cu-label { font-weight:600; color:var(--text); font-size:10px; }
  .claude-usage-widget .cu-bar-wrap { width:60px; height:10px; background:var(--border); border-radius:5px; overflow:hidden; position:relative; }
  .claude-usage-widget .cu-bar { height:100%; border-radius:5px; transition:width 0.5s; }
  .claude-usage-widget .cu-pct { font-weight:700; font-size:10px; min-width:28px; text-align:right; }
  .cu-green { background:linear-gradient(90deg, #10b981, #34d399); }
  .cu-yellow { background:linear-gradient(90deg, #f59e0b, #fbbf24); }
  .cu-orange { background:linear-gradient(90deg, #f97316, #fb923c); }
  .cu-red { background:linear-gradient(90deg, #ef4444, #f87171); }
"""
content = content.replace('.usage-label {', css_add + '\n  .usage-label {')

# 2. Replace the Claude AI link button with usage widget
old_claude = '<a class="usage-link claude" href="https://claude.ai/settings/usage" target="_blank">\U0001f916 Claude AI</a>'
new_claude = """<div class="claude-usage-widget">
      <a href="https://claude.ai/settings/usage" target="_blank" style="text-decoration:none;font-size:11px;">\U0001f916</a>
      <span class="cu-label">5h</span>
      <div class="cu-bar-wrap"><div class="cu-bar" id="claude5hBar" style="width:0%"></div></div>
      <span class="cu-pct" id="claude5hPct">--%</span>
      <span class="cu-label" style="margin-left:2px;">7d</span>
      <div class="cu-bar-wrap"><div class="cu-bar" id="claude7dBar" style="width:0%"></div></div>
      <span class="cu-pct" id="claude7dPct">--%</span>
    </div>"""
content = content.replace(old_claude, new_claude)

# 3. Add JS to fetch and update Claude usage
js_add = """
    // Claude.ai Usage
    function updateClaudeUsage() {
      fetch('/api/claude-usage')
        .then(r => r.json())
        .then(data => {
          if (!data.accounts) return;
          let acct = data.accounts.find(a => a.email && a.email.includes('linou520')) || data.accounts[0];
          if (!acct) return;
          let org = acct.organizations && acct.organizations.find(o => !o.error && o.usage && o.usage.five_hour);
          if (!org) return;
          let usage = org.usage || {};
          let h5 = usage.five_hour ? usage.five_hour.utilization : 0;
          let d7 = usage.seven_day ? usage.seven_day.utilization : 0;

          function setBar(barId, pctId, val) {
            var bar = document.getElementById(barId);
            var pct = document.getElementById(pctId);
            if (!bar || !pct) return;
            bar.style.width = Math.min(val, 100) + '%';
            pct.textContent = val + '%';
            bar.className = 'cu-bar ' + (val < 50 ? 'cu-green' : val < 70 ? 'cu-yellow' : val < 85 ? 'cu-orange' : 'cu-red');
            pct.style.color = val < 50 ? '#10b981' : val < 70 ? '#d97706' : val < 85 ? '#f97316' : '#ef4444';
          }
          setBar('claude5hBar', 'claude5hPct', h5);
          setBar('claude7dBar', 'claude7dPct', d7);
        })
        .catch(function(e) { console.warn('Claude usage fetch failed:', e); });
    }
    updateClaudeUsage();
    setInterval(updateClaudeUsage, 300000);
"""

# Insert before closing </script>
content = content.replace('</script>', js_add + '\n  </script>', 1)

open('/home/linou/.openclaw/dashboard/index.html', 'w').write(content)
print('HTML updated successfully')
