module.exports = function (hostname, rootDir) {
    if (typeof hostname === "string" && hostname != "") {
        hostname = hostname + ".";
    } else {
        hostname = "";
    }
	return `server {
        listen       80;
        server_name  ${hostname}localhost;
        root   ${rootDir};
        autoindex on;

        location / {
            
            index  index.php index.html index.htm;
        }
        error_page   500 502 503 504  /50x.html;
        location = /50x.html {
            root   html;
        }

        location ~ \.php$ {

            fastcgi_pass    127.0.0.1:9000;
            fastcgi_split_path_info ^(.+\.php)(/.+)$;
            include fastcgi_params;
            fastcgi_index index.php;
            fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        }

        
    }`;
};