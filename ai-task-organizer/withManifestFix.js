const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withManifestMergerFix(config) {
    return withAndroidManifest(config, async (config) => {
        const androidManifest = config.modResults;

        // Add the tools namespace to the root manifest tag if not present
        if (!androidManifest.manifest.$['xmlns:tools']) {
            androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
        }

        // Add tools:replace to the application tag
        const app = androidManifest.manifest.application[0];
        if (app) {
            if (!app.$['tools:replace']) {
                app.$['tools:replace'] = 'android:appComponentFactory';
            } else if (!app.$['tools:replace'].includes('android:appComponentFactory')) {
                app.$['tools:replace'] += ',android:appComponentFactory';
            }
            // Force AndroidX CoreComponentFactory 
            app.$['android:appComponentFactory'] = 'androidx.core.app.CoreComponentFactory';
        }

        return config;
    });
};
