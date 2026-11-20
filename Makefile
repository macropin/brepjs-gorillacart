# gorillacart — 3D-printable accessories for the Gorilla Carts 200L dump cart.
#
# Each accessory is a src/<name>.brep.ts module; everything here drives the
# brepjs CLI against them. Targets act on every part, or on one with
# PART=<name> (e.g. `make verify PART=bladed-tool-holder`). Requires Node 24+
# (`brew install node`).
#
# src/assemblies/ holds scenes, not parts: accessories placed on a schematic
# cart (cart.brep.ts) for the README's assembled renders. They are never
# verified against dimensions or exported for printing.

PARTS   := $(patsubst src/%.brep.ts,%,$(wildcard src/*.brep.ts))
PART    ?=
SELECT  := $(or $(PART),$(PARTS))
SCENES  := $(filter-out cart,$(patsubst src/assemblies/%.brep.ts,%,$(wildcard src/assemblies/*.brep.ts)))
SCENE   ?=
SHOW    := $(or $(SCENE),$(SCENES))
# Scenes whose accessories are too small to read on a whole-cart render. These
# are framed on the accessories instead.
CLOSEUPS := bladed-tool-holder mounting-plate pole-holder tie-down-block tool-battery-holder side-extensions-stacked
# Scenes drawn against a backdrop of their own, src/assemblies/backdrops/<scene>.brep.ts,
# instead of the bare cart. Only what the scene adds to its backdrop is coloured.
BACKDROPS := $(patsubst src/assemblies/backdrops/%.brep.ts,%,$(wildcard src/assemblies/backdrops/*.brep.ts))
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
#
# The renderer is deterministic, so the preview is too, as long as ImageMagick
# writes no metadata: by default it stamps date:create/date:modify text chunks
# and a tIME chunk, which would change the file on every render. -strip and the
# chunk exclusions keep an unchanged model's preview byte-identical.
$(MEDIA)/%.png: $(OUT)/%/shots/iso.png
	@mkdir -p $(MEDIA)
	@if command -v magick >/dev/null 2>&1; then \
		magick $< \
			-gravity South -chop 0x80 +repage \
			-fuzz 10% -trim +repage \
			-bordercolor 'srgb(6,6,12)' -border 26 \
			-filter Lanczos -resize $(PREVIEW_WIDTH)x \
			-unsharp 0x0.6+0.7+0.01 \
			-strip -define png:exclude-chunks=date,time \
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

## assemblies: render each kit fitted to the cart, into media/<name>-assembled.png (one with SCENE=<name>)
#
# Each scene is exported to STEP alongside the bare cart, or its own backdrop
# if it has one, then scripts/render-assembly.mjs renders the pair through the
# same camera and colours whatever the scene adds. Scenes listed in CLOSEUPS are
# framed on the accessories rather than the whole cart. Needs ImageMagick.
assemblies: node_modules
	@set -e; mkdir -p $(MEDIA); for s in cart $(SHOW); do \
		mkdir -p $(OUT)/assemblies/$$s; \
		$(BREP) export src/assemblies/$$s.brep.ts --step --out $(OUT)/assemblies/$$s; \
	done; \
	for s in $(filter $(BACKDROPS),$(SHOW)); do \
		mkdir -p $(OUT)/assemblies/backdrops/$$s; \
		$(BREP) export src/assemblies/backdrops/$$s.brep.ts --step --out $(OUT)/assemblies/backdrops/$$s; \
	done; \
	for s in $(SHOW); do \
		base=$(OUT)/assemblies/cart/cart.step; \
		if echo " $(BACKDROPS) " | grep -q " $$s "; then base=$(OUT)/assemblies/backdrops/$$s/$$s.step; fi; \
		node scripts/render-assembly.mjs \
			--scene $(OUT)/assemblies/$$s/$$s.step \
			--base $$base \
			--out $(MEDIA)/$$s-assembled.png \
			$$(echo " $(CLOSEUPS) " | grep -q " $$s " && echo "--closeup 1"); \
	done

## sweep: build each part at the limits of the dimensions the web generator lets you change
sweep: node_modules
	node scripts/sweep-params.mjs $(PART)

## web: run the web generator locally at http://localhost:5173/brepjs-gorillacart/
web: node_modules
	npx vite web

## web-build: type-check and build the web generator into web/dist, as GitHub Pages serves it
web-build: node_modules
	npx tsc -p web
	npx vite build web

## all: verify, render, export, and render the assemblies
all: verify render export assemblies

## clean: remove generated artifacts (keeps the README previews)
clean:
	rm -rf $(OUT) web/dist

## distclean: clean, and drop node_modules and the README previews
distclean: clean
	rm -rf node_modules $(addprefix $(MEDIA)/,$(addsuffix .png,$(PARTS))) \
		$(addprefix $(MEDIA)/,$(addsuffix -assembled.png,$(SCENES)))

.PHONY: help install verify render preview export assemblies sweep web web-build all clean distclean
