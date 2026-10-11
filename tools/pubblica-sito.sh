#!/bin/bash
# Professore Digitale - (vecchio metodo, non più usato dalla 3.5.1)
# Il sito non si carica più nel ramo gh-pages: GitHub rifiuta i file oltre 100 MB (installatori e .deb).
# Ora: Release vX.Y.Z con i file di dist/github/rilascio-X.Y.Z/ (compreso sito-X.Y.Z.zip), poi il workflow
# .github/workflows/pubblica-sito.yml pubblica il sito da solo. Vedi docs/Pubblicare_su_GitHub.pdf o tools/pubblica-tutto.sh.
# Autore: Danilo D'Auria - Licenza MIT
echo "Questo comando non si usa più: create la Release su GitHub con i file di dist/github/rilascio-X.Y.Z/"
echo "(guida: docs/Pubblicare_su_GitHub.pdf), oppure da Linux con «gh»: tools/pubblica-tutto.sh"
exit 1
