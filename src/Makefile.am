# Change these to modify how installation is performed
topextensiondir = $(datadir)/gnome-shell/extensions
uuid = weather@gnome-shell-extensions.gnome.org
extensiondir = $(topextensiondir)/$(uuid)

dist_extension_DATA = extension.js convenience.js
nodist_extension_DATA = prefs.js $(EXTRA_EXTENSION)

prefs.js: prefs.js.in $(top_builddir)/config.status
	$(AM_V_GEN) sed -e "s|[@]TOPEXTENSIONDIR@|$(topextensiondir)|" $< > $@

EXTRA_DIST = prefs.js.in
CLEANFILES = prefs.js
