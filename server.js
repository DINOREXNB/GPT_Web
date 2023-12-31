const express=require("express");
var querystring=require("querystring");
var bodyParser=require('body-parser');
var session=require('express-session');
var http=require("http");
var mysql=require('mysql2');
const fs=require("fs");
const yaml = require('js-yaml');

/********************读取Settings.yaml********************/
var settings;
try {
  const yamlContent = fs.readFileSync('Settings.yaml', 'utf8');
  settings = yaml.load(yamlContent);
  console.log(settings);
} catch (error) {
  console.error('Error reading or parsing YAML file:', error);
}
/********************加载变量********************/
var app=express();
const host=settings.server.host;
const port=settings.server.port;
const location=settings.server.location;
var body=[];//临时存储组织ID与APIkey
var dialogue=[];//临时存储对话信息
var dialogueHTML=[];//临时存储html
var User=new Map();//存储用户组织ID与APIkey
var orgid='';//临时存储orgid
var dialogue_id=0; 
var CurrentDialogueID=0;
var audiodata=[];//bug**********************
var replyID=0;
var DialogueOptionsHTML=`<li class="select-option" data-value="-1">New chat</li>`;
var New_Summary={
  "isSummary":0,
  "isClickNewChat":0
};
/*********************创建服务器**********************/
http.createServer((request,response)=>{
    response.writeHead(200,{'Content-Type':'text/plain'});
});
console.log(`Server is running at http://${host}:${port}`);
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
//处理登录请求********************************
app.post('/process-login',(req,res)=>{
    req.on("data", (chunk) => {
      body.push(chunk);
    });
    req.on("end",()=>{
      req.session.sign = true;
      req.session.name = 'Client';
      body = Buffer.concat(body).toString();
      body = querystring.parse(body);
      User.set(body.orgid,body.APIkey);
      req.session.orgid=body.orgid;
      orgid=body.orgid;
      body=[];
      res.redirect(`${location}/Main.html`);
    })
});
//请求获取APIkey********************************
app.get('/get-info',(req,res)=>{
  if (req.session.sign){
    res.json({"orgid":req.session.orgid,"APIkey":User.get(req.session.orgid)});
  }else{
    res.json({"orgid":orgid,"APIkey":User.get(orgid)});
  }
})
//获取此时的对话ID********************************
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
    res.json({
      status:'success'
    });
  })
})
//获取replyID********************************
app.post('/getreplyID',(req,res)=>{
  req.on('data',(chunk)=>{
    body.push(chunk);
  })
  req.on('end',()=>{
    body = Buffer.concat(body).toString();
    body=parseInt(body);
    replyID=body;
    console.log("replyID: ",replyID);
    body=[];
    res.json({
      status:'success'
    });
  })
});
//获取dialogueHTML********************************
app.post('/getDialogueHTML',(req,res)=>{
  req.on('data',(chunk)=>{
    body.push(chunk);
  });
  req.on('end',()=>{
    dialogueHTML=Buffer.concat(body).toString();
    body=[];    
    res.json({
      status:'success'
    });
  });
});
//获取orgid
app.post('/getorgid',(req,res)=>{
  req.on('data',(chunk)=>{
    body.push(chunk);
  });
  req.on('end',()=>{
    orgid=Buffer.concat(body).toString();
    body=[];   
    res.json({
      status:'success'
    }); 
  });
});
//发送对话ID********************************
app.post('/sendDialogueID',(req,res)=>{
  req.on('data',(chunk)=>{
    body.push(chunk);
  });
  req.on('end',()=>{
    orgid=Buffer.concat(body).toString();
    body=[];    
    sql_id="SELECT id FROM `dialogue` "+`WHERE orgid=${JSON.stringify(orgid)}`+" ORDER BY id DESC LIMIT 1";
    connectInfo.query(sql_id,(err,result,fields)=>{
      if(err){
        console.log('[SELECT ERROR] - ',err.message);
        res.status(500).json({"id":-2,"status":"fail"});
        return;
      }
      if(result.length>0){
        dialogue_id=result[0].id;
        console.log("数据库id最大值为: ",dialogue_id);
        res.json({ id: dialogue_id});
      } else {
        console.log("数据库id最大值为: ",-1);
        res.json({ id: -1 }); 
      }
    }); 
  });
});
//存储历史对话********************************
app.post('/saveDialogue',(req,res)=>{
  console.log("存储对话中...");
  req.on('data',(chunk)=>{
    dialogue.push(chunk);
  });
  req.on('end',()=>{
    dialogue=Buffer.concat(dialogue).toString();
    console.log(JSON.parse(dialogue));
    dialogue=JSON.stringify(dialogue);
    CurrentDialogueID=dialogue_id;
    sql_delete="DELETE FROM `dialogue` "+`where id=${dialogue_id} and orgid=${JSON.stringify(orgid)}`;
    sql_insert="INSERT INTO `dialogue` VALUES "+`(
      ${dialogue_id},
      ${JSON.stringify(orgid)},
      ${dialogue},
      ${dialogueHTML},
      ${replyID},
      ${New_Summary.isSummary},
      ${New_Summary.isClickNewChat}
    )`;
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
    dialogue=[];
    res.json({
      status:'success'
    });
  });
});
//加载历史对话********************************
app.post('/loadDialogue',(req,res)=>{
  console.log("加载对话中...");
  var data={};
  req.on('data',(chunk)=>{
    body.push(chunk);
  });
  req.on('end',()=>{
    body = Buffer.concat(body).toString();
    body = parseInt(body);
    console.log("selectedIndex: ",body);
    sql_load="SELECT * FROM `dialogue` where id"+`=${body} and orgid="${orgid}"`;
    connectInfo.query(sql_load,(err,result,fields)=>{
      if(err){
        console.log('[SELECT ERROR] - ',err.message);
        return;
      }
      if(result.length!=0){
        CurrentDialogueID=result[0].id;
        data={
          "replyID":result[0].replyID,
          "dialogueHTML":result[0].html,
          "dialogue":result[0].conversation,
          "isClickNewChat":result[0].isClickNewChat,
          "isSummary":result[0].isSummary
        }
      }
      res.json(data);
    });
    body=[];
  })
});
//接收并保存对话选项********************************
app.post('/getDialogueOptions',(req,res)=>{
  var body=[];
  req.on('data',(chunk)=>{
    body.push(chunk);
  });
  req.on('end',()=>{
    DialogueOptionsHTML=Buffer.concat(body).toString();
    sql_delete_option="DELETE FROM `user` "+`where orgid=${JSON.stringify(orgid)}`;
    sql_option="INSERT INTO `user` VALUES "+`(
      ${JSON.stringify(orgid)},
      ${JSON.stringify(DialogueOptionsHTML)}
    )`;
    connectInfo.query(sql_delete_option,(err,result,fields)=>{
      if(err){
        console.log('[DELETE ERROR] - ',err.message);
        return;
      }
    });
    connectInfo.query(sql_option,(err,result,fields)=>{
      if(err){
        console.log('[INSERT ERROR] - ',err.message);
        return;
      }
      console.log("存储对话选项成功！");
    });
    DialogueOptionsHTML='';
  });
  res.json({"status":"success"});
});
//发送对话选项********************************
app.post('/sendDialogueOptions',(req,res)=>{
  var body=[];
  req.on('data',(chunk)=>{
    body.push(chunk);
  });
  req.on('end',()=>{
    body=Buffer.concat(body).toString();
    body=JSON.stringify(body);
    sql_load_option="SELECT * FROM `user` "+`where orgid=${body}`;
    connectInfo.query(sql_load_option,(err,result,fields)=>{
      if(err){
        console.log('[SELECT ERROR] - ',err.message);
        return;
      }
      if(result.length==0){
        DialogueOptionsHTML=`<li class="select-option" data-value="-1">New chat</li>`;
        res.json({
          "HTML":DialogueOptionsHTML
        });
      }else{
        res.json({
          "HTML":result[0].DialogueOption
        });
      }
    });
  });
});
//获取isSummary_isClickNewChat********************************
app.post('/getNewSummary',(req,res)=>{
  var body=[];
  req.on('data',(chunk)=>{
    body.push(chunk);
  });
  req.on('end',()=>{
    body=Buffer.concat(body).toString();
    New_Summary=JSON.parse(body);
    console.log("New_summary is :",New_Summary);
  });
  res.json({"status":"success"});
});
//发送isSummary_isClickNewchat********************************
app.post('/sendNewSummary',(req,res)=>{
  var body=[];
  req.on('data',(chunk)=>{
    body.push(chunk);
  });
  req.on('end',()=>{
    body=parseInt(Buffer.concat(body).toString());
    console.log("body is : ",body);
    sql_load="SELECT * FROM `dialogue` where id"+`=${body} and orgid="${orgid}"`;
    connectInfo.query(sql_load,(err,result,fields)=>{
      if(err){
        console.log('[SELECT ERROR] - ',err.message);
        return;
      }
      if(result.length!=0){
        New_Summary.isClickNewChat=result[0].isClickNewChat;
        New_Summary.isSummary=result[0].isSummary;
        console.log("New_summary to send is :",New_Summary);
      }
    });
    res.json({
      "isClickNewChat":New_Summary.isClickNewChat,
      "isSummary":New_Summary.isSummary
    });
  });
});

//发送刷新前的dialogueID********************************
app.post('/sendCurrentDialogueID',(req,res)=>{
  console.log("刷新前对话ID为 ",CurrentDialogueID);
  res.json({
    "CurrentDialogueID":parseInt(CurrentDialogueID)
  });
});
//删除session********************************
app.get('/delete-session',(req,res)=>{
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    res.json({
      status:'success'
    });
  });
});
//加载静态资源********************************
app.use('/GPT_Web',express.static('GPT_Web'))
app.get('/', (req,res)=>{
    if (req.session.sign) {//检查用户是否已经登录
      console.log(req.session);//打印session的值
      res.redirect(`${location}/Main.html`);
    }else{
      res.sendFile(__dirname+"/"+"/Index.html");
    }
    console.log("访问欢迎界面");
});
app.get('/Main.html', (req,res)=>{
    res.sendFile(__dirname+"/"+"/Main.html");
    console.log("访问主界面");
})
app.get('/main.js',(req,res)=>{
  fs.readFile("./main.js",(err,data)=>{
    if(err){
      console.log("加载main.js失败！");
      throw err;
    }
    res.writeHead(200,{
      "Content-type":"text/javascript"
    });
    res.end(data)
  });
});
app.get('/marked.js',(req,res)=>{
  fs.readFile("./marked.js",(err,data)=>{
    if(err){
      console.log("加载marked.js失败！");
      throw err;
    }
    res.writeHead(200,{
      "Content-type":"text/javascript"
    });
    res.end(data)
  });
});
app.get('/css/Main.css',(req,res)=>{
  fs.readFile("./css/Main.css",(err,data)=>{
    if(err){
      console.log("加载Main.css失败！");
      throw err;
    }
    res.writeHead(200,{
      "Content-type":"text/css"
    });
    res.end(data)
  });
});
app.get('/css/Index.css',(req,res)=>{
  fs.readFile("./css/Index.css",(err,data)=>{
    if(err){
      console.log("加载Index.css失败！");
      throw err;
    }
    res.writeHead(200,{
      "Content-type":"text/css"
    });
    res.end(data)
  });
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
