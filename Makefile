# gorillacart — 3D-printable accessories for the Gorilla Carts 200L dump cart.
#
# Each accessory is a src/<name>.brep.ts module; everything here drives the
# brepjs CLI against them. Targets act on every part, or on one with
# PART=<name> (e.g. `make verify PART=machete-sleeve`). Requires Node 24+
# (`brew install node`).

PARTS   := $(patsubst src/%.brep.ts,%,$(wildcard src/*.brep.ts))
PART    ?=
SELECT  := $(or $(PART),$(PARTS))
OUT     := out
MEDIA   := media
BREP    := npx brep
PREVIEW_WIDTH := 760

.DEFAULT_GOAL := help

## help: list the available targets and parts
help:
	@echo "gorillacart — make targets:"
	@echo
	@sed -n 's/^## //p' $(MAKEFILE_LIST) | awk -F': ' '{printf "  \033[1m%-10s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "parts: $(PARTS)"
	@echo

## install: install the toolchain (brepjs + OCCT kernel)
install: node_modules

node_modules: package.json
	npm install
	@touch node_modules

## verify: check each solid is valid and matches its declared dimensions
verify: node_modules
	@set -e; for p in $(SELECT); do \
		mkdir -p $(OUT)/$$p; \
		$(BREP) verify src/$$p.brep.ts --check --json $(OUT)/$$p/report.json; \
	done

## render: write iso/front/top/right PNGs and refresh the README previews
render: node_modules
	@set -e; for p in $(SELECT); do \
		mkdir -p $(OUT)/$$p $(MEDIA); \
		$(BREP) verify src/$$p.brep.ts --check --snapshot $(OUT)/$$p/shots; \
		$(MAKE) --no-print-directory $(MEDIA)/$$p.png; \
	done

# The snapshot renderer fits the model with a wide margin and burns a size label
# into the corner, so the raw iso frame is mostly empty. Drop the label, trim to
# the part, pad, and scale up for a preview that fills its frame. Falls back to
# the raw frame where ImageMagick is unavailable.
$(MEDIA)/%.png: $(OUT)/%/shots/iso.png
	@mkdir -p $(MEDIA)
	@if command -v magick >/dev/null 2>&1; then \
		magick $< \
			-gravity South -chop 0x80 +repage \
			-fuzz 10% -trim +repage \
			-bordercolor 'srgb(6,6,12)' -border 26 \
			-filter Lanczos -resize $(PREVIEW_WIDTH)x \
			-unsharp 0x0.6+0.7+0.01 \
			$@ && echo "preview -> $@ ($$(magick identify -format '%wx%h' $@))"; \
	else \
		cp $< $@; \
		echo "preview -> $@ (uncropped: install imagemagick to zoom)"; \
	fi

## preview: open the live viewer for PART, re-evaluating on save
preview: node_modules
	@test -n "$(PART)" || { echo "usage: make preview PART=<name>  (one of: $(PARTS))"; exit 2; }
	$(BREP) preview src/$(PART).brep.ts --watch

## export: write STEP + STL behind a validity gate
export: node_modules
	@set -e; for p in $(SELECT); do \
		mkdir -p $(OUT)/$$p; \
		$(BREP) export src/$$p.brep.ts --step --stl --out $(OUT)/$$p; \
	done

## all: verify, render, and export
all: verify render export

## clean: remove generated artifacts (keeps the README previews)
clean:
	rm -rf $(OUT)

## distclean: clean, and drop node_modules and the README previews
distclean: clean
	rm -rf node_modules $(addprefix $(MEDIA)/,$(addsuffix .png,$(PARTS)))

.PHONY: help install verify render preview export all clean distclean
