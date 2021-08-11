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
let lixieActive = true;

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
.get('/raw_action/', urlencodedParser, function (req, res) {
	console.log("ACTION", lixieActive);
	lixieActive = true;
	red = Math.floor(Math.random() * 255)
	green = Math.floor(Math.random() * 255)
	blue = Math.floor(Math.random() * 255)
	update = 1;
	io.sockets.emit('updateColor', {
		r : red,
		g : green,
		b : blue
	});
	
	res.send("ok");
})
.get('/raw_active/', urlencodedParser, function (req, res) {
	console.log("ACTIVE");
	lixieActive = !lixieActive;
	res.send("ok");
})

app.get('/relayState', urlencodedParser, function (req, res) {
	res.render('relay.ejs', {
		"relayState" : relayState,
		"AllumerDate" : AllumerDate,
		"EteindreDate" : EteindreDate,
		"MaintenantDate" : new Date(),
		"otherDate" : otherDate
	});
})
.get('/relay', urlencodedParser, function (req, res) {
	let now = new Date();
	
	let StringReturn = now.getFullYear() +'/'+ now.getMonth() +'/'+ now.getDate() +' '+ now.getHours() +':'+ now.getMinutes() +':'+ now.getSeconds() + " "+ relayState;
	
	res.send(StringReturn);
})

.get('/nr', urlencodedParser, function (req, res) {
	timeOutAllumerEtEteindre();
	res.redirect("./relayState");
})

.post('/changeDate', urlencodedParser, function (req, res) {
	
	let tmpDate = new Date(req.body.year, req.body.month-1, req.body.day, req.body.hours, req.body.minutes, 0, 0);
	if(req.body.AllumerEteindre == "Allumer") {
		AllumerDate = tmpDate;
		let delayAllumer = AllumerDate.getTime() - (new Date() ).getTime();
		
		console.log(delayAllumer);
		
		clearTimeout(AllumerTimeout);
		AllumerTimeout = setTimeout(AllumerRelay, delayAllumer);
	}
	else {
		EteindreDate = tmpDate;
		let delayEteindre = EteindreDate.getTime() - (new Date() ).getTime();
		clearTimeout(EteindreTimeout);
		EteindreTimeout = setTimeout(EteindreRelay, delayEteindre);
	}
	
	res.redirect("./relayState");
})

.post('/newDate', urlencodedParser, function (req, res) {
	
	console.log(req.body);
	
	otherDate[req.body.ID] = {};

	let tmpDate = new Date(req.body.year, req.body.month-1, req.body.day, req.body.hours, req.body.minutes, 0, 0);
	
	otherDate[req.body.ID]["Date"] = tmpDate;
	
	let delay = tmpDate.getTime() - (new Date() ).getTime();
	
	
	
	if(req.body.etat === '1') {
		otherDate[req.body.ID]["Etat"] = 1;
		otherDate[req.body.ID]["Timeout"] = setTimeout(AllumerRelay, delay);
	}
	else {
		otherDate[req.body.ID]["Etat"] = 0;
		otherDate[req.body.ID]["Timeout"] = setTimeout(EteindreRelay, delay);
	}
	
	res.redirect("./relayState");
})

.post('/supprimerDate', urlencodedParser, function (req, res) {

	if(typeof(req.body.ID) != "undefined" && typeof(otherDate[req.body.ID]) != "undefined") {
		clearTimeout(otherDate[req.body.ID]["Timeout"]);
		delete(otherDate[req.body.ID])
	}
	
	res.redirect("./relayState");
})


function AllumerRelay() {
	relayState = 1;
	io.sockets.emit('updateRelay',  {
		"UUID" : "0",
		"status" : 1,
	});
	console.log("ON ALLUME");
}
function EteindreRelay() {
	relayState = 0;
	io.sockets.emit('updateRelay',  {
		"UUID" : "0",
		"status" : 0,
	});
	console.log("ON ETEINT");
}

function padLeadingZeros(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}

function currentDateJson() {
	let _r = red;
	let _g = green;
	let _b = blue;
	
	if (!lixieActive) {
		_r = 0;
		_g = 0;
		_b = 0;
	}
	
	let now = new Date();
	let StringReturn = padLeadingZeros(now.getFullYear(), 4) + '/' + padLeadingZeros((now.getMonth()+1), 2) +'/'+ padLeadingZeros(now.getDate(), 2) +
		' ' + padLeadingZeros(now.getHours(), 2) + ':' + padLeadingZeros(now.getMinutes(), 2) + ':' + padLeadingZeros(now.getSeconds(), 2) + 
		" " + padLeadingZeros(_r, 3) +","+ padLeadingZeros(_g, 3) +","+ padLeadingZeros(_b, 3);

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


function timeOutAllumerEtEteindre() {
	let now = new Date();
	// now = new Date(now.getTime() + 1000*60*  -40   + 1000*60*60*  -15);
	
	AllumerDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0);
	AllumerDate = new Date(AllumerDate.getTime() + generateRandomTimer()*60*1000);
	
	EteindreDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 2, 0, 0, 0);
	EteindreDate = new Date(EteindreDate.getTime() + generateRandomTimer()*60*1000);
	
	let delayAllumer = AllumerDate.getTime() - now.getTime();
	if(delayAllumer <= 0) delayAllumer = 0;
	
	let delayEteindre = EteindreDate.getTime() - now.getTime();
	if(delayEteindre <= 0) delayEteindre = 0;
	
	clearTimeout(AllumerTimeout);
	clearTimeout(EteindreTimeout);
	
	AllumerTimeout = setTimeout(AllumerRelay, delayAllumer);
	EteindreTimeout = setTimeout(EteindreRelay, delayEteindre);
}




function checkRelayStatus() {
	
	
	let nowDate = new Date();
	var now = new Date(nowDate.getTime() + 1000*60*  -40   + 1000*60*60*  -15);
	// console.log(now);
	// console.log(relayState);
	
	let maintenant = now.getHours()*60 + now.getMinutes();
	
	let debut = 20*60 + randomTimer;
	
	let fin = 2*60 + randomTimer;
	
	
	console.log(debut)
	console.log(maintenant)
	console.log(fin);
	console.log(relayState + " ----------")
	
	if((maintenant >= debut && maintenant <= 23*60+59) || (maintenant >= 0 && maintenant <= fin)) {
		if(relayState == 0) {
			console.log("On genere un nouveau random");
			relayState = 1;
			generateRandomTimer();
		}
		
	}
	else {
		if(relayState == 1) {
			console.log("On genere un nouveau random");
			generateRandomTimer();
			relayState = 0;
		}
	}
}

function generateRandomTimer() {
	return [-1,1][Math.random()*2|0]  *  Math.floor(Math.random() * (45 - 5 + 1) + 5);
}