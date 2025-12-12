from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from PyPDF2 import PdfReader, PdfWriter
import json

def img_to_pdf_coords(x, y, img_w=1654, img_h=2339):
    pw, ph = A4
    return (x / img_w) * pw, ph - (y / img_h) * ph

data = json.load(open("mapped_fields.json"))

temp_pdf = "temp_fillable.pdf"
c = canvas.Canvas(temp_pdf, pagesize=A4)

for field in data:
    name = field["name"]
    x, y = img_to_pdf_coords(field["x1"], field["y1"])
    width = (field["x2"] - field["x1"]) * (595/1654)
    height = 16

    c.acroForm.textfield(
        name=name,
        x=x, y=y,
        width=width,
        height=height,
        borderWidth=0.5,
        forceBorder=True
    )

c.save()
pdf = "Declaratie-stabilire-impozit-cladire.pdf"
original = PdfReader(pdf)
fillable = PdfReader(temp_pdf)
writer = PdfWriter()

page = original.pages[0]
page.merge_page(fillable.pages[0])
writer.add_page(page)
output_pdf = "Declaratie-stabilire-impozit-cladire.pdf_FillABLE.pdf"
with open(output_pdf, "wb") as f:
    writer.write(f)

print("PDF final generat: Declaratie-stabilire-impozit-cladire.pdf_FillABLE.pdf")
