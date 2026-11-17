"""Kokoro narration with correct pronunciation of common Islamic phrases."""
import os, re
import numpy as np

MODEL_DIR = os.environ.get("MODEL_DIR", "/vercel/sandbox/models")
SR = 24000

# phrase regex -> IPA (Kokoro/misaki phoneme set)
PHRASES = [
    (r"\bas[- ]?salaa?m[uo]?[- ']?\s*(?:o\s+)?[ae]la[iy]?ku[mn]\b(?:\s+wa\s*rahmatullah[i]?(?:\s+wa\s*barakatuh[u]?)?)?",
     "ˌæsəlˈɑːmu əlˈeɪkʊm"),
    (r"\bwa\s*rahmatullah[i]?\s+wa\s*barakatuh[u]?\b", "wɐ ɹˌɑːmætʊlˈɑː wɐ bəɹˈɑːkætʊ"),
    (r"\ballah\s+hafiz\b", "ɐlˈɑː hˈɑːfɪz"),
    (r"\bjazak\s*allah[u]?\s*kh?air(?:an)?\b", "dʒəzˈɑːkɐlˌɑː kˈeɪɹ"),
    (r"\bbismillah(?:\s+ir[- ]?rahman\s+ir[- ]?rahim)?\b", "bɪsmˈɪlɑː"),
    (r"\bin\s*sh?a['\s]*allah\b", "ɪn ʃˈɑː ɐlˈɑː"),
    (r"\bmash?a['\s]*allah\b", "mˈɑː ʃˈɑː ɐlˈɑː"),
    (r"\bsubhan['\s]*allah\b", "sˈʊbhɑːn ɐlˈɑː"),
    (r"\balhamdulillah\b", "ˌælhæmdʊlˈɪlɑː"),
    (r"\ballahu\s+akbar\b", "ɐlˈɑːhu ˈækbɑːɹ"),
    (r"\bastaghfirullah\b", "ˌæstɐɡfˈɪɹʊlɑː"),
    (r"\bfitrah\b", "fˈɪtɹə"),
    (r"\btawbah\b", "tˈaʊbə"),
    (r"\ballah\b", "ɐlˈɑː"),
    (r"\bqur'?an\b", "kʊɹˈɑːn"),
    (r"\bseerah\b", "sˈiːɹə"),
    (r"\bsahabah?\b", "səhˈɑːbə"),
    (r"\bsurah\b", "sˈʊɹə"),
    (r"\bayah\b", "ˈɑːjə"),
    (r"\bhadith\b", "hədˈiːθ"),
    (r"\bsalah\b", "sˈɑːlɑː"),
    (r"\bwudu\b", "wʊdˈuː"),
    (r"\bramadan\b", "ɹˌɑːmədˈɑːn"),
    (r"\bmakkah\b", "mˈɑkə"),
    (r"\bmadinah\b", "mədˈiːnə"),
]
_PH = [(re.compile(p, re.I), ipa) for p, ipa in PHRASES]


class Voice:
    def __init__(self):
        from kokoro_onnx import Kokoro
        self.k = Kokoro(os.path.join(MODEL_DIR, "kokoro-v1.0.onnx"), os.path.join(MODEL_DIR, "voices-v1.0.bin"))
        self.voices = set(self.k.get_voices())

    def _segments(self, text):
        """Split text into [(is_phoneme, str)] around known phrases."""
        segs = [(False, text)]
        for rx, ipa in _PH:
            out = []
            for is_ph, s in segs:
                if is_ph:
                    out.append((is_ph, s))
                    continue
                pos = 0
                for m in rx.finditer(s):
                    if m.start() > pos:
                        out.append((False, s[pos:m.start()]))
                    out.append((True, ipa))
                    pos = m.end()
                if pos < len(s):
                    out.append((False, s[pos:]))
            segs = out
        return segs

    def say(self, text, voice="af_heart", speed=0.92):
        text = re.sub(r"[؀-ۿﷺﷻ]+", " ", text)  # drop Arabic script / ﷺ glyphs
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            return np.zeros(int(0.2 * SR), np.float32)
        if voice not in self.voices:
            voice = "af_heart"
        lang = "en-gb" if voice.startswith("b") else "en-us"
        segs = self._segments(text)
        if all(not p for p, _ in segs):
            a, _ = self.k.create(text, voice=voice, speed=speed, lang=lang)
        else:
            parts = []
            for is_ph, s in segs:
                if is_ph:
                    parts.append(s)
                elif s.strip():
                    parts.append(self.k.tokenizer.phonemize(s, lang))
            ph = " ".join(p.strip() for p in parts if p.strip())
            ph = re.sub(r"\s+([,.!?;:])", r"\1", ph)
            a, _ = self.k.create(ph, voice=voice, speed=speed, is_phonemes=True)
        a = np.asarray(a, np.float32)
        idx = np.where(np.abs(a) > 0.01)[0]
        if len(idx):
            a = a[max(0, idx[0] - 240): idx[-1] + 1200]
        return a
