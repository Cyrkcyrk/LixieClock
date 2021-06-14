const http = require('http');
const express = require('express')
const app = express()
app.use(express.static("/home/cyrille/horloge/public/"));

var httpServer = http.createServer(app);
httpServer.listen(70);

var io = require('socket.io')(httpServer); 

var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });

var mysql = require('mysql');
var local = require('./local.js');
var con = mysql.createConnection({
	host: local.db().HOST,
	user: local.db().USER,
	password: local.db().PSWD,
	database: local.db().DDB
});

let red = 100;
let green = 0;
let blue = 255;
let update = 0;


let relayState = 0;
let AllumerDate, EteindreDate;
let AllumerTimeout, EteindreTimeout;
let otherDate = {};


timeOutAllumerEtEteindre();

io.sockets.on('connection', function (socket) {
	socket.emit('message', 'Connected to Lixie\'s socket')
	
	.on('message', function (message) {
		console.log('Un client me parle ! Il me dit : ' + message);
	})
	
	.on("changeColor", function(message) {
		// console.log(message);
		red = message.r;
		green = message.g;
		blue = message.b;
		io.sockets.emit('updateColor', message);
		update = 1;
	})
	
	.on("changeRelay", function(message) {
		// console.log(message);
		relayState = message.status;
		io.sockets.emit('updateRelay', message);
	})
});

app.get('/', urlencodedParser, function (req, res) {
	let hex = rgbToHex(red, green, blue);
	res.render('index.ejs', {
		"colorHEX" : hex,
		"colorRGB" : {"r" : red, "g": green, "b": blue}
	});

})
.get('/changeColor', urlencodedParser, function (req, res) {
	if (typeof(req.query.colorRed) != "undefined") {
		red = req.query.colorRed;
	}
	
	if (typeof(req.query.colorGreen) != "undefined") {
		green = req.query.colorGreen;
	}
	
	if (typeof(req.query.colorBlue) != "undefined") {
		blue = req.query.colorBlue;
	}
	update = 1;
	
	res.redirect("/");
})


.get('/raw/', urlencodedParser, function (req, res) {
	res.send(currentDateJson());
})

function padLeadingZeros(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

function currentDateJson() {
	let now = new Date();
	
	// let nowDate = new Date();
	// var now = new Date(nowDate.getTime() + (1000*60* -28) + (1000*60*60* -16))
	
	let StringReturn = padLeadingZeros(now.getFullYear(), 4) + '/' + padLeadingZeros((now.getMonth()+1), 2) +'/'+ padLeadingZeros(now.getDate(), 2) +
		' ' + padLeadingZeros(now.getHours(), 2) + ':' + padLeadingZeros(now.getMinutes(), 2) + ':' + padLeadingZeros(now.getSeconds(), 2) + 
		" " + padLeadingZeros(red, 3) +","+ padLeadingZeros(green, 3) +","+ padLeadingZeros(blue, 3);
	
	// console.log(StringReturn)
	
	return StringReturn;
}

SaveDataBase();
function SaveDataBase() {
	if(update == 1) {
		con.query("UPDATE `Data` SET `HEX`='"+ rgbToHex(red, green, blue) +"',`Mode`=1 WHERE `ID` = 1;", function (err) {
			if (err) {
				console.log(err);
			}
			else {
				update = 0;
				console.log("Saved");
			}
		})
	}
	setTimeout(SaveDataBase, 5000);
}

getDataFromDB();
function getDataFromDB() {
	con.query("SELECT * FROM `Data` WHERE `ID` = 1;", function (err, result, field) {
		if(err) console.log(err);
		else {
			if(typeof(result[0]) != "undefined") {
				let tmp_col = hexToRgb(result[0].HEX);
				
				red = tmp_col.r;
				green = tmp_col.g;
				blue = tmp_col.b;
			}
			else {
				console.log("DB is empty");
				console.log(result);
			}
		}
	})
}

function rgbToHex(r, g, b) {
	let redHEX = parseInt(r).toString(16) + "";
	if(redHEX.length < 2)
		redHEX = "0" + redHEX;
		
	let greenHEX = parseInt(g).toString(16) + "";
	if(greenHEX.length < 2)
		greenHEX = "0" + greenHEX;
	
	let blueHEX = parseInt(b).toString(16) + "";
	if(blueHEX.length < 2)
		blueHEX = "0" + blueHEX;
	
	return ("" + redHEX + greenHEX + blueHEX).toUpperCase();
}

function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}