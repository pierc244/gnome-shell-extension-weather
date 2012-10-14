extensionurl = https://github.com/canek-pelaez/gnome-shell-extension-weather

# Change these to modify how installation is performed
topextensiondir = $(datadir)/gnome-shell/extensions
uuid = weather@gnome-shell-extensions.gnome.org

extensiondir = $(topextensiondir)/$(uuid)

dist_extension_DATA = stylesheet.css prefs.xml search.xml
nodist_extension_DATA = metadata.json $(EXTRA_EXTENSION)

EXTRA_DIST = metadata.json.in
CLEANFILES = metadata.json

metadata.json: metadata.json.in $(top_builddir)/config.status
	$(AM_V_GEN) sed -e "s|[@]LOCALEDIR@|$(LOCALEDIR)|" \
	    -e "s|[@]uuid@|$(uuid)|" \
	    -e "s|[@]url@|$(extensionurl)|" $< > $@

gschemas_in = org.gnome.shell.extensions.weather.gschema.xml.in

@INTLTOOL_XML_NOMERGE_RULE@

gsettings_SCHEMAS = $(gschemas_in:.xml.in=.xml)

@GSETTINGS_RULES@

EXTRA_DIST += $(gschemas_in)
CLEANFILES += $(gschemas_in:.xml.in=.valid) $(gsettings_SCHEMAS)
