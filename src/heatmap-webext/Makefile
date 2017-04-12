all:

run:
	# Run with Marionette enabled so that we can instrument the browser
	# from test cases.
	/Applications/FirefoxDeveloperEdition.app/Contents/MacOS/firefox -marionette

lint:
	node_modules/.bin/eslint 'background-script.js' 'content_script.js' 'networking.js'
