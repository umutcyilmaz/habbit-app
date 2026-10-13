"""Render the static source-reference HTML offline, without browser access.
Dependencies live in a temporary venv (WeasyPrint + pypdfium2). PDFs stay temporary.
This document renderer approximates browser CSS; PNGs are labelled accordingly.
"""
import sys
from pathlib import Path
from weasyprint import HTML, default_url_fetcher
import pypdfium2
source=Path(sys.argv[1]);target=Path(sys.argv[2]);target.mkdir(parents=True,exist_ok=True)
def local_only(url,*args,**kwargs):
    if not url.startswith('data:'):
        raise ValueError('Reference rendering is offline; external resources disabled')
    return default_url_fetcher(url,*args,**kwargs)
for file in source.glob('*.html'):
    pdf=file.with_suffix('.pdf')
    HTML(string=file.read_text(),url_fetcher=local_only).write_pdf(pdf)
    document=pypdfium2.PdfDocument(str(pdf))
    image=document[0].render(scale=4).to_pil()
    image.crop((0,0,1170,2532)).save(target/(file.stem+'.png'))
    document.close()
    print(file.stem)
