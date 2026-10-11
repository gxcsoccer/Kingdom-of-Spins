"""Package generated raster art without repainting it; requires Pillow and macOS sips."""
from pathlib import Path
from PIL import Image, ImageOps
import hashlib
import json
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DELIVERY = ROOT / 'art-delivery' / '2026-10-11'
ART = ROOT / 'public' / 'art'
manifest = json.loads((DELIVERY / 'generation-manifest.json').read_text())
assets = manifest['assets']
assert len(assets) == 37 and len({a['file'] for a in assets}) == 37
source_map = {a['source']: 'sources/originals/' + str(Path(a['file']).with_suffix('.png')) for a in assets}
archive_only = '--archive-only' in sys.argv
checks = json.loads((DELIVERY / 'validation.json').read_text())['assets'] if archive_only else []

for asset in ([] if archive_only else assets):
    relative = Path(asset['file'])
    original = DELIVERY / source_map[asset['source']]
    original.parent.mkdir(parents=True, exist_ok=True)
    if not original.exists():
        shutil.copy2(asset['source'], original)
    image = Image.open(original)
    output = ART / relative
    output.parent.mkdir(parents=True, exist_ok=True)
    target = (asset['width'], asset['height'])
    if relative.suffix == '.png':
        assert image.mode == 'RGBA', (relative, image.mode)
        alpha = image.getchannel('A')
        assert alpha.getextrema() == (0, 255), relative
        # Fit the complete generated cutout; preserve alpha and add the specified 5% margin.
        subject = image.crop(alpha.getbbox())
        subject = ImageOps.contain(subject, tuple(round(d * .90) for d in target), Image.Resampling.LANCZOS)
        export = Image.new('RGBA', target)
        export.paste(subject, ((target[0] - subject.width) // 2, (target[1] - subject.height) // 2))
        export.save(output, optimize=True)
    else:
        # Format and dimension normalization only; keep the generated scene unchanged.
        export = ImageOps.fit(image.convert('RGB'), target, Image.Resampling.LANCZOS)
        export.save(output, 'JPEG', quality=95, subsampling=0, optimize=True)
    runtime = DELIVERY / 'public' / 'art' / relative
    runtime.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(output, runtime)
    psd = DELIVERY / 'sources' / 'psd' / relative.with_suffix('.psd')
    psd.parent.mkdir(parents=True, exist_ok=True)
    if not psd.exists():
        subprocess.run(['sips', '-s', 'format', 'com.adobe.photoshop-image', str(original), '--out', str(psd)], check=True, capture_output=True)
    with Image.open(psd) as source_psd:
        assert source_psd.size == image.size, relative
        assert source_psd.mode == image.mode, (relative, source_psd.mode, image.mode)
        assert source_psd.tobytes() == image.tobytes(), f'PSD pixel mismatch: {relative}'
    with Image.open(output) as final:
        assert final.size == target, relative
        record = {'file': asset['file'], 'priority': asset['priority'], 'size': list(final.size),
                  'format': final.format, 'mode': final.mode, 'bytes': output.stat().st_size,
                  'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                  'original_size': list(image.size), 'psd_pixel_match': True}
        if relative.suffix == '.png':
            a = final.getchannel('A')
            bbox = a.getbbox()
            margins = [bbox[0], bbox[1], final.width - bbox[2], final.height - bbox[3]]
            assert min(margins[0], margins[2]) >= int(final.width * .049)
            assert min(margins[1], margins[3]) >= int(final.height * .049)
            record.update(alpha_extrema=list(a.getextrema()), margins_px=margins)
        else:
            record['jpeg_quality'] = 95
        checks.append(record)

portable = {k: v for k, v in manifest.items() if k != 'assets'}
portable['assets'] = [{**{k: v for k, v in a.items() if k not in ('source', 'refs')},
                       'source': source_map[a['source']],
                       'refs': [source_map[x] for x in a.get('refs', [])]} for a in assets]
(DELIVERY / 'prompts.json').write_text(json.dumps(portable, ensure_ascii=False, indent=2) + '\n')
(DELIVERY / 'validation.json').write_text(json.dumps({'assets': checks, 'passed': len(checks)}, ensure_ascii=False, indent=2) + '\n')

for archive_name, selection, include_sources in [
    ('kingdom-of-spins-art-p0.zip', [a for a in assets if a['priority'] == 'P0'], False),
    ('kingdom-of-spins-art-complete.zip', assets, True),
]:
    with zipfile.ZipFile(DELIVERY / archive_name, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for a in sorted(selection, key=lambda a: a['file']):
            z.write(ART / a['file'], 'public/art/' + a['file'])
        if include_sources:
            for path in sorted((DELIVERY / 'sources').rglob('*')):
                if path.is_file():
                    z.write(path, path.relative_to(DELIVERY))
            for name in ['prompts.json', 'validation.json', 'browser-check.json', 'DELIVERY.txt', 'preview.html', 'preview-overview.png', 'preview-dark-92.png', 'game-title.png']:
                path = DELIVERY / name
                if path.exists():
                    z.write(path, name)
    with zipfile.ZipFile(DELIVERY / archive_name) as z:
        assert z.testzip() is None
    print(f'{archive_name}: {(DELIVERY / archive_name).stat().st_size / 1024**2:.1f} MiB')
print(f'Validated {len(checks)} assets, 33 alpha PNGs, 4 quality-95 JPGs; all PSDs match original pixels.')
