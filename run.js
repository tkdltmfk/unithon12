const app = require('express')()
const http = require('http').Server(app)
const io = require('socket.io')(http)
const util = require('./route/util')
const bodyParser = require('body-parser')
const request = require('request')
const mysql = require('mysql')
const session = require('express-session')
const  MySQLStore = require('express-mysql-session')(session)

app.use(bodyParser.urlencoded({
  extended: false
}))
app.use(bodyParser.json())

app.use(session({
  // key: 'sid',
  secret: 'sdafdsav',
  resave: false,
  saveUninitialized: true,
  store:  new  MySQLStore({
    host: 'localhost',
       user: 'root',
    password: 'unithon',
    database: 'unithon',
    checkExpirationInterval: 600 * 1000
  }),
  cookie: {
    maxAge: 600 * 1000
  }
}))

http.listen(8008, function() {
  util.log("server start")
})

var userSlist = [] //열린 룸 정보
var userSeP = [] //userSlist sort를 위한 포지션

function scriptSort(s, callback) { //스크립트를 1글자 단위로 자름
  r = s.replace(/(?:\r\n|\r|\n| |\.|,|)/g, '')
  list = r.split('')
  callback(list)
}

// function MakeScript(script, callback) { //문자열을 받아
//   scriptSort(script, function(sc) {
//     var p = 0
//     //scriptS[0] = []
//     for (i = 0; i < sc.length; i++) {
//       sp = i % spl
//       if (i != 0 && sp == 0) {
//         p++
//         //scriptS[p] = []
//       }
//       //scriptA[i] = []
//       //scriptS[p][sp] = []
//       scriptA[i] = sc[i]
//       //scriptA[i][1] = scriptS[p][sp][1] = 0
//       if (i == sc.length - 1) callback(scriptA)
//     }
//   })
// }

function analogyP(p, msg, callback) {
  Bscript = [] //문자열 단위
  Bsl = 0

  Bmsg = userSlist[p].Bmsg
  Bpos = userSlist[p].Bpos

  Bmsg[Bpos] = msg
  if (Bpos == 0) {
    msgSplit = msg.split(' ')
    for(i = 0; i < msgSplit.length; i++) {
      Bscript = Bscript.concat(msgSplit[i].split(''))
      if (i == msgSplit.length - 1) {
        userSlist[p].Bmsg = Bmsg
        userSlist[p].Bpos = Bpos + 1
        CompareAS(Bscript, userSlist[p].scriptA, function(pos) {
          callback(pos)
        })
      }
    }
  } else {
    Bsplit = Bmsg[Bpos - 1].split(' ')
    msgSplit = msg.split(' ')
    check = false
    for (i = 0; i < msgSplit.length; i++) {
      if (!check && msgSplit[i] != Bsplit[i]) {
        check = true
        Bscript = Bscript.concat(msgSplit[i].split(''))
      } else if (check) {
        Bscript = Bscript.concat(msgSplit[i].split(''))
      }
      if (i == msgSplit.length - 1) {
        userSlist[p].Bmsg = Bmsg
        userSlist[p].Bpos = Bpos + 1
        CompareAS(Bscript, userSlist[p].scriptA, function(pos) {
          callback(pos)
        })
      }
    }
  }
  //CompareSS()
}

function CompareAS(Bscript, scriptA, callback) {
  if (Bscript.length > 0) {
    confirm = 0.5
    lastT = -1
    for (i = 0; i < scriptA.length; i++) {
      if (Bscript[0] == scriptA[i]) {
        count = 0
        k = 0
        lastp = 0
        for (j = i; j < i + Bscript.length; j++) {
          if (Bscript[k] == scriptA[j]) {
            count++
            lastp = j
          }
          if (count / Bscript.length > confirm && count > 1) {
            confirm = count / Bscript.length
            lastT = lastp
          }
          k++
        }
      }
      if (i == scriptA.length - 1) {
        callback(lastT)
      }
    }
  }
}

const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'unithon',
  database: 'unithon'
})

const issession = function(req, res, next) {
  if (req.session.auth) return next()
  else res.sendStatus(400)
}

app.post('/login', function(req, res) {
  var token = req.body.token
  var header = "Bearer " + token // Bearer 다음에 공백 추가. 고정

  var api_url = 'https://openapi.naver.com/v1/nid/me'
  var options = {
    url: api_url,
    headers: {
      'Authorization': header
    }
  };
  request.get(options, function(error, response, body) {
    if (!error && response.statusCode == 200) {
      json = JSON.parse(body)
      var email = json.response.email;
      var name = json.response.name;
      db.getConnection(function(err, connection) {
        if (!err) {
          connection.query('select email from users where email = ?', [email], function(err, rows) {
            if (!err) {
              if (rows.length == 0) {
                connection.query('INSERT INTO users set ?', {
                  'email': email,
                  'name': name
                }, function(err, rows) {
                  connection.release()
                  if (err) {
                    res.sendStatus(500).send(err)
                  } else {
                    util.log(email + ' 로그인 성공')
                    req.session.email = email
                    req.session.auth = true
                    res.sendStatus(200)
                  }
                })
              } else {
                connection.release()
                util.log(email + ' 로그인 성공')
                req.session.email = email
                req.session.auth = true
                res.sendStatus(200)
              }
            } else res.sendstatus(500)
          })
        }
      })
    } else {
      util.log('error');
      if (response != null) {
        res.sendStatus(500);
      }
    }
  })
})

app.get('/getSlist', issession, function(req, res, next) {
  db.getConnection(function(err, connection) {
    if (!err) {
      connection.query('select id,title,content,date from script where email = ?', [req.session.email], function(err, rows) {
        connection.release()
        if (!err) {
          res.set('Content-Type', 'application/json; charset=utf-8');
          res.send(rows)
        } else res.sendStatus(500)
      })
    } else res.sendStatus(500)
  })
})

// app.get('/selectS', issession, function(req, res, next) {
//   id = req.query.id
//   db.getConnection(function(err, connection) {
//     if(!err) {
//       connection.query('select content from script where id = ? and email = ?',[id,req.session.email],function(err,rows) {
//         connection.release()
//         if(!err) {
//           MakeScript(rows[0].content,function(script) {
//             if(userSeP.length == 0) userSlist.push({email:req.session.email,id:id,scriptA:script,Bmsg:[],Bpos:0})
//             else {
//               userSlist[userSeP[0]] = {email:req.session.email,id:id,scriptA:script,Oscript:rows[0].content,Bmsg:[],Bpos:0}
//               userSeP.shift()
//             }
//             res.sendStatus(200)
//           })
//         }
//       })
//     }
//   })
// })

function MakeSRoom(id, email, callback) {
  db.getConnection(function(err, connection) {
    if (!err) {
      connection.query('select content from script where id = ? and email = ?', [id, email], function(err, rows) {
        connection.release()
        if (!err) {
          scriptSort(rows[0].content, function(script) {
            if (userSeP.length == 0) {
              userSlist.push({
                email: email,
                id: id,
                scriptA: script,
                Bmsg: [],
                Bpos: 0,
                size: 100,
                spa: 0,
                tspa: 0
              })
              callback(0)
            } else {
              pos = userSeP[0]
              userSlist[pos] = {
                email: email,
                id: id,
                scriptA: script,
                Bmsg: [],
                Bpos: 0,
                size: 100,
                spa: 0,
                tspa: 0
              }
              userSeP.shift()
              callback(pos)
            }
          })
        }
      })
    } else console.log(err)
  })
}

app.all('*', function(req, res) {
  res.sendStatus(404)
})

var dtime = {}

io.sockets.on('connection',function(socket) {

socket.emit('toclient',{msg:'Welcome !'});

   socket.on('fromclient',function(data){

       socket.broadcast.emit('toclient',data); // 자신을 제외하고 다른 클라이언트에게 보냄

       socket.emit('toclient',data); // 해당 클라이언트에게만 보냄. 다른 클라이언트에 보낼려면?

       console.log('Message from client :'+data.msg);

   }
})

io.on('connection', function(socket) {
  var pos
  var id
  var email
  var type

  console.log(socket.id)

  socket.on('AppConnect', function(data) {
    util.log('app socket connect to user ' + data)
    email = data
    socket.join(email)
    // for (i = 0; i < userSlist.length; i++) {
    //   if (userSlist[i].email == data) {
    //     socket.join(data)
    //     id = userSlist[i].id
    //     email = data
    //     pos = i
    //     type = 'app'
    //     if (!(typeof dtime[type + email] === undefined)) {
    //       clearTimeout(dtime[type + email])
    //       dtime[type + email] = undefined
    //     }
    //     socket.emit('WebJoin', [id, email])
    //     socket.broadcast.to(roomid).emit('AppJoin', [id, email, userSlist[i].Oscript])
    //     break
    //   }
    // }
  })

  socket.on('WebConnect', function(data) {
    util.log('web socket connect to user ' + data)
    email = data
    socket.join(email)
    for (i = 0; i < userSlist.length; i++) {
      if (userSlist[i].email == data) {
        id = userSlist[i].id
        email = data
        pos = i
        type = 'web'
        if (!(typeof dtime[type + email] === undefined)) {
          clearTimeout(dtime[type + email])
          dtime[type + email] = undefined
        }
        socket.emit('AppJoin', [id, email])
        socket.broadcast.to(email).emit('WebJoin', [id, email])
        break
      }
    }
  })

  socket.on('AppJoin', function(data) {
    util.log('join script to app user ' + data[1])
    if (!(typeof dtime[type + email] === undefined)) {
      clearTimeout(dtime[type + email])
      dtime[type + email] = undefined
    }
    id = data[0]
    //email = data[1]
    if (userSlist.length == 0) {
      MakeSRoom(id, email,function(msg) {
        pos = msg
        socket.broadcast.to(email).emit('AppJoin', [id, email])
      })
    } else {
      for (i = 0; i < userSlist.length; i++) {
        if (userSlist[i].email == email && userSlist[i].id == id) {
          pos = i
          socket.emit('WebJoin', [id, email])
          socket.broadcast.to(email).emit('AppJoin', [id, email])
          break
        } else if (i == userSlist.length - 1) {
          MakeSRoom(id, email,function(msg) {
            pos = msg
            socket.broadcast.to(email).emit('AppJoin', [id, email])
          })
        }
      }
    }
  })

  socket.on('WebJoin', function(data) {
    util.log('join script to web user ' + data[1])
    id = data[0]
    if (!(typeof dtime[type + email] === undefined)) {
      clearTimeout(dtime[type + email])
      dtime[type + email] = undefined
    }
    //email = data[1]
    if (userSlist.length == 0) {
      MakeSRoom(id, email,function(msg) {
        pos = msg
        //socket.broadcast.to(email).emit('WebJoin', [id, email])
      })
    } else {
      for (i = 0; i < userSlist.length; i++) {
        if (userSlist[i].email == email && userSlist[i].id == id) {
          pos = i
          socket.emit('AppJoin', [id, email])
          //socket.broadcast.to(email).emit('WebJoin', [id, email])
          break
        } else if (i == userSlist.length - 1) {
          MakeSRoom(id, email,function(msg) {
            pos = msg
            //socket.broadcast.to(email).emit('WebJoin', [id, email])
          })
        }
      }
    }
  })

  socket.on('leave', function(data) {
    util.log('leave user ' + email)
  //  socket.leave(email)
    socket.broadcast.to(email).emit("leave", [id, email])
    userSlist[pos] = {}
    userSeP.push(pos)
    //console.log(io.sockets.adapter.rooms[email])
  })

  socket.on('voice', function(msg) {
    analogyP(pos, msg, function(position) {
      console.log(position)
      socket.broadcast.to(email).emit("voice", position)
    })
  })
  socket.on('size', function(msg) {
    socket.broadcast.to(email).emit("size", msg)
  })
  socket.on('spa', function(msg) {
    socket.broadcast.to(email).emit("spa", msg)
  })
  socket.on('tspa', function(msg) {
    socket.broadcast.to(email).emit("tspa", msg)
  })
  socket.on('up', function(msg) {
    socket.broadcast.to(email).emit("up", 0)
  })
  socket.on('down', function(msg) {
    socket.broadcast.to(email).emit("down", 1)
  })

  // socket.on('disconnect', function() {
  //   dtime[type + email] = setTimeout(function() {
  //     //socket.leave(email)
  //     io.sockets.in(email).emit("leave", [id, email])
  //     userSlist[pos] = {}
  //     userSeP.push(pos)
  //     // if(io.sockets.adapter.rooms[email] == undefined) {
  //     //   console.log('A')
  //     //   userSlist[pos] = {}
  //     //   userSeP.push(pos)
  //     // }
  //   }, 10000)
  // })
})
