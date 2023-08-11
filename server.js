const express=require("express");
var querystring=require("querystring");
var bodyParser=require('body-parser');
var session=require('express-session');
var http=require("http");
var mysql=require('mysql2');
const fs=require("fs");
const yaml = require('js-yaml');

// const { Configuration, OpenAIApi } = require('openai');
// const configuration = new Configuration({
//   organization: '',
//   apiKey: process.env.OPENAI_API_KEY,
// });
// const openai = new OpenAIApi(configuration);
// openai.listEngines()
//   .then(response => {
//     console.log('Response:', response);
//   })
//   .catch(error => {
//     console.error('Error:', error);
//   });
/********************读取Settings.yaml********************/
var settings;
try {
  const yamlContent = fs.readFileSync('Settings.yaml', 'utf8');
  settings = yaml.load(yamlContent);
  console.log(settings);
} catch (error) {
  console.error('Error reading or parsing YAML file:', error);
}
var app=express();
const ip=settings.server.ip;
const port=settings.server.port;
const location=settings.server.location;
var body=[];//临时存储组织ID与APIkey
var dialogue=[];//临时存储对话信息
var User=new Map();//存储用户组织ID与APIkey
var orgid='';//临时存储orgid
var dialogue_id=0; 
var audiodata=[];
/*********************创建服务器**********************/
http.createServer((request,response)=>{
    response.writeHead(200,{'Content-Type':'text/plain'});
});
console.log(`Server is running at http://${ip}:${port}`);
/*********************创建session**********************/
app.use(session({
  secret:'gptweb1145141919810',
  cookie:{maxAge:20*60*1000},
  resave: false,
  saveUninitialized: false
}));
/********************MySQL数据库********************/
//配置本机mysql连接基本信息
let connectInfo = mysql.createConnection({
	host: settings.mysql.host,
	port: settings.mysql.port,
	user: settings.mysql.user,
	password: settings.mysql.password,
	database: settings.mysql.database,
})
//数据库建立连接
connectInfo.connect((err)=>{
  if(err){
    console.log('[query] - :'+err);
  }
  console.log("MySQL connection succeed!");
});
/********************处理请求********************/
app.use('/GPT_Web',express.static('GPT_Web'))
app.get('/', (req,res)=>{
    if (req.session.sign) {//检查用户是否已经登录
      console.log(req.session);//打印session的值
      res.redirect(`${location}/Main.html`);
    }else{
      req.session.sign = true;
      req.session.name = 'Client';
      res.sendFile(__dirname+"/"+"/Index.html");
    }
    console.log("访问欢迎界面");
});
app.get('/Main.html', (req,res)=>{
    res.sendFile(__dirname+"/"+"/Main.html");
    console.log("访问主界面");
})
app.post('/process-login',(req,res)=>{
    req.on("data", (chunk) => {
      body.push(chunk);
    });
    req.on("end",()=>{
      body = Buffer.concat(body).toString();
      body = querystring.parse(body);
      User.set(body.orgid,body.APIkey);
      req.session.orgid=body.orgid;
      orgid=body.orgid;
      body=[];
      res.redirect(`${location}/Main.html`);
    })
});
//请求获取APIkey
app.get('/get-info',(req,res)=>{
  res.json({"orgid":orgid,"APIkey":User.get(orgid)});
  // sql=`select * from user where orgid="${orgid}"`;
  // console.log("获取APIkey...");
  // if(req.session.APIkey!=''){
  //   res.json({"orgid":req.session.orgid,"APIkey":req.session.APIkey});
  //   console.log("获取APIkey成功！");
  // }else{
  //   connectInfo.query(sql,(err,result,fields)=>{
  //     if(err){
  //       console.log('[SELECT ERROR] - ',err.message);
  //       console.log("获取APIkey失败！");
  //       return;
  //     }
  //     if(result.length!=0){
  //       console.log("获取APIkey成功！");
  //       res.json({"orgid":result[0].orgid,"APIkey":result[0].APIkey});
  //       return;
  //     }else{
  //       console.log("获取APIkey失败!");
  //     }
  //   });
  // }
})
//获取此时的对话ID
app.post('/getDialogueID' , (req , res)=>{
  req.on('data',(chunk)=>{
    body.push(chunk);
  })
  req.on('end',()=>{
    body = Buffer.concat(body).toString();
    body=parseInt(body);
    dialogue_id=body;
    console.log("dialogue_id: ",dialogue_id);
    body=[];
  })
  res.status(200);
})

//存储历史对话
app.post('/saveDialogue',(req,res)=>{
  console.log("存储对话中...");
  req.on('data',(chunk)=>{
    dialogue.push(chunk);
  });
  req.on('end',()=>{
    dialogue=Buffer.concat(dialogue).toString();
    console.log(JSON.parse(dialogue));
    dialogue=JSON.stringify(dialogue);
    //TODO:将对话数据存入数据库
    sql_delete="DELETE FROM `dialogue` "+`where id=${dialogue_id}`;
    sql_insert="INSERT INTO `dialogue` VALUES "+`(${dialogue_id},${JSON.stringify(orgid)},${dialogue})`;
    connectInfo.query(sql_delete,(err,result,fields)=>{
      if(err){
        console.log('[DELETE ERROR] - ',err.message);
        return;
      }
    });
    connectInfo.query(sql_insert,(err,result,fields)=>{
      if(err){
        console.log('[INSERT ERROR] - ',err.message);
        return;
      }
      console.log("存储对话成功！");
    });
  });
  dialogue=[];
  res.status(200);
});
//加载历史对话
app.post('/loadDialogue',(req,res)=>{
  console.log("加载对话中...");
  req.on('data',(chunk)=>{
    body.push(chunk);
  });
  req.on('end',()=>{

  })
});
app.get('/images/audiototext.png' , (req , res)=>{
  fs.readFile("./images/audiototext.png",(err,data)=>{
    if(err){
      console.log("加载图片失败！");
      throw err;
    }
    res.writeHead(200,{
      "Content-type":"image/png"
    });
    res.end(data);
  });
})
app.get('/images/texttoimage.png' , (req , res)=>{
  fs.readFile("./images/texttoimage.png",(err,data)=>{
    if(err){
      console.log("加载图片失败！");
      throw err;
    }
    res.writeHead(200,{
      "Content-type":"image/png"
    });
    res.end(data);
  });
})
app.get('/images/prompt.png' , (req , res)=>{
  fs.readFile("./images/prompt.png",(err,data)=>{
    if(err){
      console.log("加载图片失败！");
      throw err;
    }
    res.writeHead(200,{
      "Content-type":"image/png"
    });
    res.end(data);
  });
})
app.get('/images/GPT.ico' , (req , res)=>{
  fs.readFile("./images/GPT.ico",(err,data)=>{
    if(err){
      console.log("加载图片失败！");
      throw err;
    }
    res.writeHead(200,{
      "Content-type":"x-icon"
    });
    res.end(data);
  });
})
var server=app.listen(port,()=>{});
