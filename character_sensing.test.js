import { calibratePDF, extractCharacters } from "./pdfService";

sample_scripts = ['sample_scripts/(BBC) UNT. STEVE MCQUEEN Pilot.Pdf',
    'sample_scripts/{HULU x A24}_Ramy YoussefJerrod Carmichael.pdf',
    'sample_scripts/A Star is Born_10.27.16.pdf',
    'sample_scripts/ABC - Dr. Ken 1x01 - Pilot.pdf',
    'sample_scripts/EBGrayBeardFreestyle TWEAK-1[1].pdf',
    'sample_scripts/Something_Stupid_-_FINAL_JUNE_10 3.00.38 PM.pdf'
]

for (file in sample_scripts) {
    calibratePDF(file, pdfjsLib, 5)
}