
How to get the UI running in Debian/Ubuntu
------------------------------------------

1.  You need Apache and Node.js 0.4.x

        sudo apt-get install apache2 nodejs

2.  Figure out Apache's document root (usually /var/www) and put the path for
    the UI into an environment variable

        export builddir="/var/www/ox7"
    
3.  Create the new directory for the UI with write rights for yourself
    
        sudo mkdir $builddir
        sudo chown $(whoami) $builddir

4.  Build the UI and the documentation:

        ./build.sh
        ./build.sh doc

5.  If everything works fine, the documentation should be at
    http://localhost/ox7/doc/apache.html. Continue reading there!


How to get the UI running on MacOS X
------------------------------------

1.  Figure out Apache's document root. If you haven't change anything, it's:

    /Library/WebServer/Documents
    
2.  Create a new folder ox7 in Apache's document root

3.  You need node.js to build the UI:

    - Visit https://sites.google.com/site/nodejsmacosx/ and install stable version.
    
    - Open terminal
    
    - Set environment variable:
        export buildir="/Library/WebServer/Documents/ox7"
        
    - Build UI:
      ./build.sh
      
    - Build documentation:
      ./build.sh doc

4.  If everything works fine, the documentation should be at
    http://localhost/ox7/doc/apache.html. Continue reading there!
    
5.  If you want to work with eclipse, visit
    http://stackoverflow.com/questions/829749/launch-mac-eclipse-with-environment-variables-set
    
    Your eclipse.sh should contain:
    
    #!/bin/sh
    export builddir="/Library/WebServer/Documents/ox7"
    exec "`dirname \"$0\"`/eclipse" $@
    
    This is a nice trick to get automatic builds without changing project files.
