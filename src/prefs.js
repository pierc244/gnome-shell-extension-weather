/*
 *
 *  Weather extension for GNOME Shell preferences 
 *  - Creates a widget to set the preferences of the weather extension
 *
 * Copyright (C) 2012
 *     Canek Peláez <canek@ciencias.unam.mx>,
 *
 * This file is part of gnome-shell-extension-weather.
 *
 * gnome-shell-extension-weather is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell-extension-weather is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell-extension-weather.  If not, see
 * <http://www.gnu.org/licenses/>.
 *
 */

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Gettext = imports.gettext.domain('gnome-shell-extension');
const Soup = imports.gi.Soup;
const _ = Gettext.gettext;

const Lang = imports.lang;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const WEATHER_PREFS_UI = Me.dir.get_path() + '/prefs.xml';
const SEARCH_WOEID_UI = Me.dir.get_path() + '/search.xml';
const WEATHER_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.weather';

// Placeholder string, so our combobox is never empty.
const SPC6 = '\u2500\u2500\u2500\u2500\u2500\u2500';
const NO_SEL = SPC6 + SPC6 + SPC6 + SPC6 + SPC6;

const WeatherUnits = {
    CELSIUS: 0,
    FAHRENHEIT: 1
};

const WeatherWindSpeedUnits = {
    KPH: 0,
    MPH: 1,
    MPS: 2,
    KNOTS: 3
};

const WeatherPosition = {
    CENTER: 0,
    RIGHT: 1,
    LEFT: 2
};

const Columns = {
    ID: 0,
    LOCATION: 1,
    WOEID: 2
};

// Soup session (see https://bugzilla.gnome.org/show_bug.cgi?id=661323#c64)
const _httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

function getErrorLabel(message) {
    let label = new Gtk.Label();
    label.set_text(message);
    return label;
}

function positionFromString(s) {
    if (s == 'left')
        return WeatherPosition.LEFT;
    if (s == 'center')
        return WeatherPosition.CENTER;
    return WeatherPosition.RIGHT;
}

function tempUnitFromString(s) {
    if (s == 'celsius')
        return WeatherUnits.CELSIUS;
    return WeatherUnits.FAHRENHEIT;
}

function windUnitFromString(s) {
    if (s == 'kph')
        return WeatherWindSpeedUnits.KPH;
    if (s == 'mph')
        return WeatherWindSpeedUnits.MPH;
    if (s == 'm/s')
        return WeatherWindSpeedUnits.MPS;
    return WeatherWindSpeedUnits.KNOTS;
}

function positionToString(pos) {
    switch (pos) {
    case WeatherPosition.LEFT:
        return 'left';
    case WeatherPosition.CENTER:
        return 'center';
    case WeatherPosition.RIGHT:
        return 'right';
    }
    return 'left';
}

function temperatureUnitToString(unit) {
    switch (unit) {
    case WeatherUnits.CELSIUS:
        return 'celsius';
    case WeatherUnits.FAHRENHEIT:
        return 'fahrenheit';
    }
    return 'celsius';
}

function windSpeedUnitToString(unit) {
    switch (unit) {
    case WeatherWindSpeedUnits.KPH:
        return'kph';
    case WeatherWindSpeedUnits.MPH:
        return'mph';
    case WeatherWindSpeedUnits.MPS:
        return'm/s';
    case WeatherWindSpeedUnits.KNOTS:
        return'knots';
    }
    return'kph';
}

const Widget = new GObject.Class({
    Name: 'WeatherExtension.Prefs.Widget',
    GTypeName: 'WeatherExtensionPrefsWidget',
    Extends: Gtk.Box,

    _init: function(params) {
        this.parent(params);
        try {
            this._settings = Convenience.getSettings(WEATHER_SETTINGS_SCHEMA);
        } catch (e) {
            this.add(getErrorLabel(_('Schema ' + WEATHER_SETTINGS_SCHEMA + ' not found.')));
            return;
        }
        let builder = new Gtk.Builder();
        try {
            builder.add_from_file(WEATHER_PREFS_UI);
        } catch (e) {
            this.add(getErrorLabel(_('UI file "' + WEATHER_PREFS_UI + '" not found.')));
            return;
        }
        this._topBox = builder.get_object('weather_top_box');
        this._fillData(builder);
        this._connectSignals(builder);
        this.add(this._topBox);
    },

    _fillData: function(builder) {
        this._city_entry = builder.get_object('city_entry');
        this._city_entry.set_text(this._settings.get_string('city'));
        this._include_condition_checkbutton =
            builder.get_object('include_condition_checkbutton');
        let b = this._settings.get_boolean('show-comment-in-panel')
        this._include_condition_checkbutton.set_active(b);
        this._position_combobox = builder.get_object('position_combobox');
        let s = this._settings.get_string('position-in-panel');
        this._position_combobox.set_active(positionFromString(s));
        this._sunrise_times_checkbutton  = builder.get_object('sunrise_times_checkbutton');
        this._sunrise_times_checkbutton.set_active(this._settings.get_boolean('show-sunrise-sunset'));
        this._show_text_checkbutton  = builder.get_object('show_text_checkbutton');
        this._show_text_checkbutton.set_active(this._settings.get_boolean('show-text-in-panel'));
        this._translate_conditions_checkbutton  =
            builder.get_object('translate_conditions_checkbutton');
        b = this._settings.get_boolean('translate-condition');
        this._translate_conditions_checkbutton.set_active(b);
        this._temperature_unit_combobox = builder.get_object('temperature_unit_combobox');
        s = this._settings.get_string('unit');
        this._temperature_unit_combobox.set_active(tempUnitFromString(s));
        this._symbolic_icons_checkbutton = builder.get_object('symbolic_icons_checkbutton');
        this._symbolic_icons_checkbutton.set_active(this._settings.get_boolean('use-symbolic-icons'));
        this._wind_speed_unit_combobox = builder.get_object('wind_speed_unit_combobox');
        s = this._settings.get_string('wind-speed-unit');
        this._wind_speed_unit_combobox.set_active(windUnitFromString(s));
        this._woeid_entry = builder.get_object('woeid_entry');
        this._woeid_entry.set_text(this._settings.get_string('woeid'));
        this._search_woeid_button = builder.get_object('search_woeid_button');
    },

    _getWoeidListAsync: function(url, fun) {
        let here = this;
        let message = Soup.Message.new('GET', url);
        _httpSession.queue_message(message, function(session, message) {
            fun.call(here, message.response_body.data);
        });
    },

    /* Someone get libxml2 some introspection love, please. */
    _parseSimpleXml: function(xml) {
        let woeids = {};
        let i = 0;
        let r = 0;
        while (r != -1) {
            r = xml.indexOf('<loc id="', i);
            if (r == -1)
                continue;
            let woeid = xml.substring(r+9, r+17);
            i = r + 18;
            r = xml.indexOf('">', i);
            i = r + 2;
            r = xml.indexOf("</loc>", i);
            let location = xml.substring(i, r);
            woeids[woeid] = location;
        }
        return woeids;
    },

    _searchForWoeid: function(str) {
        let url = 'http://xoap.weather.com/search/search?where=' + str;
        this._getWoeidListAsync(url, function(xml) {
            let woeids = this._parseSimpleXml(xml);
            this._woeids_liststore.clear();
            let i = 0;
            for (var woeid in woeids) {
                let iter = this._woeids_liststore.append();
                this._woeids_liststore.set(iter, 
                                           [ Columns.ID, Columns.LOCATION, Columns.WOEID ],
                                           [ i, woeids[woeid], woeid ]);
                i++;
            }
            this._searching_spinner.stop();
            this._search_entry.grab_focus();
            if (i > 0) {
                this._locations_combobox.set_sensitive(true);
                // Set the first one by default
                this._locations_combobox.set_active(0);
                this._search_button.set_sensitive(true);
                this._ok_button.set_sensitive(true);
            } else {
                let iter = this._woeids_liststore.append();
                this._woeids_liststore.set(iter,
                                           [ Columns.ID, Columns.LOCATION, Columns.WOEID ],
                                           [ 0, NO_SEL, NO_SEL ]);
                // Set the only one.
                this._locations_combobox.set_active(0);
                this._locations_combobox.set_sensitive(false);
                this._search_entry.set_text('');
                this._search_button.set_sensitive(false);
                this._ok_button.set_sensitive(false);
            }
            this._search_entry.select_region(0, -1);
        });
    },

    _doSearch: function(str) {
        // async search woeids
        this._searching_spinner.start();
        this._search_button.set_sensitive(false);
        this._searchForWoeid(str);
    },

    _connectSearchSignals: function(builder) {
        this._search_woeid_dialog = builder.get_object('search_woeid_dialog');
        this._search_woeid_dialog.connect('delete-event', Lang.bind(this, function() {
            this._search_woeid_dialog.destroy();
        }));
        this._woeids_liststore = builder.get_object('woeids_liststore');
        this._search_entry = builder.get_object('search_entry');
        this._search_button = builder.get_object('search_button');
        this._cancel_button = builder.get_object('cancel_button');
        this._ok_button = builder.get_object('ok_button');
        this._searching_spinner = builder.get_object('searching_spinner');
        this._locations_combobox = builder.get_object('locations_combobox');
        this._search_entry.connect('changed', Lang.bind(this, function() {
            let t = this._search_entry.get_text();
            if (t != '') {
                this._search_button.set_sensitive(true);
            } else {
                this._search_button.set_sensitive(false);
            }
        }));
        this._search_entry.connect('activate', Lang.bind(this, function() {
            let str = this._search_entry.get_text();
            if (str != '')
                this._doSearch(str);
        }));
        this._search_button.connect('clicked', Lang.bind(this, function() {
            this._doSearch(this._search_entry.get_text());
        }));
        this._search_entry.grab_focus();
    },

    _noSearchUI: function() {
        let parent = this.get_toplevel();
        let dialog = new Gtk.MessageDialog({ modal: true,
                                             message_type: Gtk.MessageType.ERROR,
                                             buttons: Gtk.ButtonsType.CLOSE,
                                             text: 'The UI file \"' + SEARCH_WOEID_UI +
                                             '\" seems to be missing.\nWe cannot ' +
                                             'search for WOEIDs.' });
        dialog.run();
        dialog.destroy();
    },

    _searchWoeid: function() {
        let builder = new Gtk.Builder();
        try {
            builder.add_from_file(SEARCH_WOEID_UI);
        } catch (e) {
            this._noSearchUI();
            return '';
        }
        this._connectSearchSignals(builder);
        let r = this._search_woeid_dialog.run();
        let woeid = '';
        let [ success, iter ] = this._locations_combobox.get_active_iter();
        if (success && r == Gtk.ResponseType.OK)
            woeid  = this._woeids_liststore.get_value(iter, Columns.WOEID);
        if (r != Gtk.ResponseType.DELETE_EVENT)
            this._search_woeid_dialog.destroy();
        return woeid;
    },

    _connectSignals: function(builder) {
        this._city_entry.connect('changed', Lang.bind(this, function() {
            this._settings.set_string('city', this._city_entry.get_text());
        }));
        this._include_condition_checkbutton.connect('toggled', Lang.bind(this, function() {
            let b = this._include_condition_checkbutton.get_active();
            this._settings.set_boolean('show-comment-in-panel', b);
        }));
        this._position_combobox.connect('changed', Lang.bind(this, function() {
            let s = positionToString(this._position_combobox.get_active());
            this._settings.set_string('position-in-panel', s);
        }));
        this._sunrise_times_checkbutton.connect('toggled', Lang.bind(this, function() {
            let b = this._sunrise_times_checkbutton.get_active();
            this._settings.set_boolean('show-sunrise-sunset', b);
        }));
        this._show_text_checkbutton.connect('toggled', Lang.bind(this, function() {
            let b = this._show_text_checkbutton.get_active();
            this._settings.set_boolean('show-text-in-panel', b);
        }));
        this._translate_conditions_checkbutton.connect('toggled', Lang.bind(this, function() {
            let b = this._translate_conditions_checkbutton.get_active();
            this._settings.set_boolean('translate-condition', b);
        }));
        this._temperature_unit_combobox.connect('changed', Lang.bind(this, function() {
            let s = temperatureUnitToString(this._temperature_unit_combobox.get_active());
            this._settings.set_string('unit', s);
        }));
        this._symbolic_icons_checkbutton.connect('toggled', Lang.bind(this, function() {
            let b = this._symbolic_icons_checkbutton.get_active();
            this._settings.set_boolean('use-symbolic-icons', b);
        }));
        this._wind_speed_unit_combobox.connect('changed', Lang.bind(this, function() {
            let s = windSpeedUnitToString(this._wind_speed_unit_combobox.get_active());
            this._settings.set_string('wind-speed-unit', s);
        }));
        this._woeid_entry.connect('changed', Lang.bind(this, function() {
            this._settings.set_string('woeid', this._woeid_entry.get_text());
        }));
        this._search_woeid_button.connect('clicked', Lang.bind(this, function() {
            let woeid = this._searchWoeid();
            if (woeid != '')
                this._woeid_entry.set_text(woeid);
        }));
    }
});

function init() {
    Convenience.initTranslations('gnome-shell-extension-weather');
}

function buildPrefsWidget() {
    let widget = new Widget();
    widget.show_all();
    return widget;
}
