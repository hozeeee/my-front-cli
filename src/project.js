const path = require('path');
const {
  exec
} = require('child_process');
const {
  program
} = require("commander");
// 提供用户界面和查询会话流
const inquirer = require('inquirer');
// Promise 版的 fs
const fse = require('fs-extra');
// 读取/修改 文件
const memFs = require('mem-fs');
const editor = require('mem-fs-editor');

// TODO: 未整理
const download = require('download-git-repo');
// const { TEMPLATE_GIT_REPO, INJECT_FILES } = require('./constants');
const chalk = require('chalk');
const ora = require('ora');
// const { getDirFileName } = require('./utils');


// 初始化参数
function Project(options) {
  this.config = Object.assign({
    projectName: '',
    description: ''
  }, options);
  const store = memFs.create();
  this.memFsEditor = editor.create(store);
}

// 检查 NodeJs 版本
Project.prototype.checkNodeJsVersion = function () {
  return new Promise((resolve, reject) => {
    const nodeJsVersionSpinner = ora("正在获取当前 Node.js 版本 ...");
    nodeJsVersionSpinner.start();
    exec("node -v", (error, stdout, stderr) => {
      console.log();
      if (error) {
        console.log(error);
        installSpinner.color = 'red';
        installSpinner.fail(chalk.red("无法获取 Node.js 版本号"));
        reject(error);
      } else {
        if (stderr) {
          console.log(stderr);
        }
        if (stdout) {
          const version = stdout;
          nodeJsVersionSpinner.succeed(`当前 Node.js 版本为 ${stdout}`);
          let temp = version.replace("v", "").split(".")
          if (temp[0] < 10) {
            nodeJsVersionSpinner.warn(
              chalk.yellow("当前 Node.js 版本低于 10 ，建议升级到 10 或以上版本")
            )
          }
        }
        resolve(stdout);
      }
      nodeJsVersionSpinner.stop();
    });
  });
}

// 检查 vue/cli 版本
Project.prototype.checkVuecliVersion = function () {
  return new Promise((resolve, reject) => {
    const spinner = ora("正在获取当前 vue/cli 版本 ...");
    spinner.start();
    exec("vue -V", (error, stdout, stderr) => {
      console.log();
      if (error) {
        console.log(error);
        installSpinner.color = 'red';
        installSpinner.fail(chalk.red("无法获取 Node.js 版本号"));
        reject(error);
      } else {
        if (stderr) {
          console.log(stderr);
        }
        if (stdout) {
          const version = stdout;
          spinner.succeed(`当前 Node.js 版本为 ${stdout}`);
          let temp = version.replace("v", "").split(".")
          if (temp[0] < 10) {
            spinner.warn(chalk.yellow("当前 Node.js 版本低于 10 ，建议升级到 10 或以上版本"))
          }
        }
        resolve(stdout);
      }
      spinner.stop();
    });
  });
}


// 
Project.prototype.create = function () {
  this.inquire()
    .then((answer) => {
      this.config = Object.assign(this.config, answer);
      // this.generate();
    });
};

// 2. 判断是否已经输入了必须参数，否则在这里输入
Project.prototype.inquire = function () {
  const prompts = [];
  // 构造函数的参数，可能为空
  const {
    projectName,
    description
  } = this.config;
  if (typeof projectName !== 'string') {
    prompts.push({
      type: 'input',
      name: 'projectName',
      message: '请输入项目名：',
      validate(input) {
        if (!input) {
          return '项目名不能为空';
        }
        if (fse.existsSync(input)) {
          return '当前目录已存在同名项目，请更换项目名';
        }
        return true;
      }
    });
  } else if (fse.existsSync(projectName)) {
    prompts.push({
      type: 'input',
      name: 'projectName',
      message: '当前目录已存在同名项目，请更换项目名',
      validate(input) {
        if (!input) {
          return '项目名不能为空';
        }
        if (fse.existsSync(input)) {
          return '当前目录已存在同名项目，请更换项目名';
        }
        return true;
      }
    });
  }

  if (typeof description !== 'string') {
    prompts.push({
      type: 'input',
      name: 'description',
      message: '请输入项目描述'
    });
  }

  return inquirer.prompt(prompts);
};


// 3. 创建项目目录
Project.prototype.generate = function () {
  const {
    projectName,
    description
  } = this.config;
  const projectPath = path.join(process.cwd(), projectName);
  // const downloadPath = path.join(projectPath, '__download__');




  const downloadSpinner = ora('正在下载模板，请稍等...');
  downloadSpinner.start();
  // 下载git repo
  download(TEMPLATE_GIT_REPO, downloadPath, {
    clone: true
  }, (err) => {
    if (err) {
      downloadSpinner.color = 'red';
      downloadSpinner.fail(err.message);
      return;
    }

    downloadSpinner.color = 'green';
    downloadSpinner.succeed('下载成功');

    // 复制文件
    console.log();
    const copyFiles = getDirFileName(downloadPath);

    copyFiles.forEach((file) => {
      fse.copySync(path.join(downloadPath, file), path.join(projectPath, file));
      console.log(`${chalk.green('✔ ')}${chalk.grey(`创建: ${projectName}/${file}`)}`);
    });

    INJECT_FILES.forEach((file) => {
      this.injectTemplate(path.join(downloadPath, file), path.join(projectName, file), {
        projectName,
        description
      });
    });

    this.memFsEditor.commit(() => {
      INJECT_FILES.forEach((file) => {
        console.log(`${chalk.green('✔ ')}${chalk.grey(`创建: ${projectName}/${file}`)}`);
      })

      fse.remove(downloadPath);

      process.chdir(projectPath);

      // git 初始化
      console.log();
      const gitInitSpinner = ora(`cd ${chalk.green.bold(projectName)}目录, 执行 ${chalk.green.bold('git init')}`);
      gitInitSpinner.start();

      const gitInit = exec('git init');
      gitInit.on('close', (code) => {
        if (code === 0) {
          gitInitSpinner.color = 'green';
          gitInitSpinner.succeed(gitInit.stdout.read());
        } else {
          gitInitSpinner.color = 'red';
          gitInitSpinner.fail(gitInit.stderr.read());
        }

        // 安装依赖
        console.log();
        const installSpinner = ora(`安装项目依赖 ${chalk.green.bold('npm install')}, 请稍后...`);
        installSpinner.start();
        exec('npm install', (error, stdout, stderr) => {
          if (error) {
            installSpinner.color = 'red';
            installSpinner.fail(chalk.red('安装项目依赖失败，请自行重新安装！'));
            console.log(error);
          } else {
            installSpinner.color = 'green';
            installSpinner.succeed('安装依赖成功');
            console.log(`${stderr}${stdout}`);

            console.log();
            console.log(chalk.green('创建项目成功！'));
            console.log(chalk.green('Let\'s Coding吧！嘿嘿😝'));
          }
        })
      })
    });
  });
}

module.exports = Project;