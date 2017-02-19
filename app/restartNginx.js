module.exports = () => {
        exec('nginx -s quit', {cwd: 'C:\\nginx\\'}, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
            }

            exec('taskkill /F /IM nginx.exe', (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                }
                exec('start nginx', {cwd: 'C:\\nginx\\'}, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`exec error: ${error}`);
                        return;
                    }


                    console.log(`stdout: ${stdout}`);
                    console.log(`stderr: ${stderr}`);
                });
                console.log(`stdout: ${stdout}`);
                console.log(`stderr: ${stderr}`);
            });

            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
        });
    }