"""Convert saved HTML pages to plain text (strip scripts/styles/nav)."""
import sys, re, html
from html.parser import HTMLParser

class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.out=[]; self.skip=0
    def handle_starttag(self, t, a):
        if t in ('script','style','svg','noscript','nav','head'): self.skip+=1
        if t in ('p','div','li','h1','h2','h3','h4','tr','br','section','article'): self.out.append('\n')
        if t=='li': self.out.append('- ')
        if t in ('h1','h2','h3','h4'): self.out.append('#'*int(t[1])+' ')
    def handle_endtag(self, t):
        if t in ('script','style','svg','noscript','nav','head') and self.skip: self.skip-=1
        if t in ('td','th'): self.out.append(' | ')
    def handle_data(self, d):
        if not self.skip: self.out.append(d)

for path in sys.argv[1:]:
    p=P(); p.feed(open(path,encoding='utf8',errors='ignore').read())
    txt=''.join(p.out)
    txt=re.sub(r'[ \t]+',' ',txt); txt=re.sub(r'\n\s*\n+','\n',txt)
    open(re.sub(r'\.html$','.txt',path),'w',encoding='utf8').write(txt.strip())
