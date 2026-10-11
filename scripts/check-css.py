#!/usr/bin/env python3
"""样式撞名检查：页面级样式必须限定在自己页面的根节点里。
报告两类问题：① 不同文件里都以同一个裸类名开头的全局规则；② 同名但内容不同的 @keyframes。
用法：python3 scripts/check-css.py   （有问题时退出码为 1）"""
import re, os, sys, collections
SHARED = {'btn', 'badge', 'chip', 'page', 'panel', 'prep', 'battle-idle', 'pop-in', 'rp-scroll', 'rp'}  # 主题公共类和页面根节点（用来限定作用域），允许别处使用
cls, kf = collections.defaultdict(set), collections.defaultdict(set)
for root, _, fs in os.walk('src'):
    for f in fs:
        if not f.endswith('.css'): continue
        p = os.path.join(root, f); raw = open(p).read(); s = re.sub(r'/\*.*?\*/', '', raw, flags=re.S)
        for m in re.finditer(r'@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}', s): kf[m.group(1)].add((p, re.sub(r'\s', '', m.group(2))))
        s = re.sub(r'@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}', '', s)
        for sel in re.findall(r'([^{}@]+)\{', s):
            for part in sel.split(','):
                m = re.match(r'^\s*\.([A-Za-z][\w-]*)', part)
                if m and m.group(1) not in SHARED: cls[m.group(1)].add(p)
bad = [f'class .{k}: {sorted(v)}' for k, v in cls.items() if len(v) > 1]
bad += [f'@keyframes {k}: {sorted({a for a, _ in v})}' for k, v in kf.items() if len({a for a, _ in v}) > 1 and len({b for _, b in v}) > 1]
print('\n'.join(bad) or 'no cross-file CSS collisions'); sys.exit(1 if bad else 0)
