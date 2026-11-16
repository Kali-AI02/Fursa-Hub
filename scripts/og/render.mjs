// Renders scripts/og/og.html into assets/img/og.png (1200×630), the image
// shown when FursaHub links are shared on WhatsApp, Facebook, X, LinkedIn.
// Needs Microsoft Edge or Google Chrome installed.  Run: npm run og
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const browsers = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = browsers.find((b) => existsSync(b));
if (!browser) throw new Error('Install Microsoft Edge or Google Chrome to render the image.');

const src = pathToFileURL(fileURLToPath(new URL('og.html', import.meta.url))).href;
const png = fileURLToPath(new URL('../../assets/img/og.png', import.meta.url));
const jpg = png.replace(/\.png$/, '.jpg');
execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=1200,630', `--screenshot=${png}`, src], { stdio: 'ignore' });

// WhatsApp ignores preview images larger than ~300 KB, so save a compressed JPEG.
if (process.platform === 'win32') {
  const ps = `Add-Type -AssemblyName System.Drawing; $i=[System.Drawing.Image]::FromFile('${png}');` +
    `$e=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|?{$_.MimeType -eq 'image/jpeg'};` +
    `$p=New-Object System.Drawing.Imaging.EncoderParameters 1;` +
    `$p.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,[long]85);` +
    `$i.Save('${jpg}',$e,$p);$i.Dispose();Remove-Item '${png}'`;
  execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore' });
  console.log('Saved', jpg);
} else {
  console.log('Saved', png, '- convert it to assets/img/og.jpg (under 300 KB) before publishing.');
}
