COMPOSITIONS := MyComp

.PHONY: render-all studio

studio:
	npx remotion studio

render-all:
	mkdir -p out
	$(foreach comp,$(COMPOSITIONS),npx remotion render src/index.ts $(comp) out/$(comp).mov --codec=prores --prores-profile=4444;)
