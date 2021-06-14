#define VERBOSE

#include <EEPROM.h>
#define EEPROM_SIZE 353
char ssid[33];
char password[64];
char raw_data_src[256];

#include <WiFi.h>
#include <DNSServer.h>
#include "ESPAsyncWebServer.h"

#define DNS_PORT 53
IPAddress apIP(8,8,4,4); // The default android DNS
DNSServer dnsServer;
//WebServer server(80);
AsyncWebServer server(80);
#include <HTTPClient.h>

#include <FastLED.h>
#define NUM_LEDS 61
#define DATA_PIN 23
CRGB leds[NUM_LEDS];
int numLed = 0;

int heure;
int minute;
int seconde;
int couleurs[3];

int _col = 0;
int _num = 0;

double now;
double delai;
bool startup;

void update_eeprom(int adr, int val) {
  int tmp;
  tmp = EEPROM.read(adr);
  if (tmp != val) {
    EEPROM.write(adr, val);  
  }  
}

void tout_eteindre() {
  int i;
  i = -1;
  while (++i < NUM_LEDS) {
    leds[i] = CRGB(0,0,0);  
  }
}

int col2pos(int col, int num) {
    //num = (num + 9) % 10;
    if (num%2 == 0) {
        return (int((12 * (num/2)) + col + 1));
    }
    else {
      return (int((12 * ((num-1)/2)) + 6 + (5 - col) + 1));
    }
}

void afficher_heure() {
  tout_eteindre();
  leds[col2pos(0, int(heure/10))] = CRGB(couleurs[0], couleurs[1], couleurs[2]);
  leds[col2pos(1, int(heure%10))] = CRGB(couleurs[0], couleurs[1], couleurs[2]);
  leds[col2pos(2, int(minute/10))] = CRGB(couleurs[0], couleurs[1], couleurs[2]);
  leds[col2pos(3, int(minute%10))] = CRGB(couleurs[0], couleurs[1], couleurs[2]);
  leds[col2pos(4, int(seconde/10))] = CRGB(couleurs[0], couleurs[1], couleurs[2]);
  leds[col2pos(5, int(seconde%10))] = CRGB(couleurs[0], couleurs[1], couleurs[2]);
  FastLED.show();
}

void afficher_erreur(char *code) {
  tout_eteindre();
  if (delai + 1000 > millis()) {
    Serial.println("PRINT COLOR");
    Serial.printf("%c\n", code[0] - '0');
    leds[col2pos(0, code[0] - '0')] = CRGB(255, 0, 0);
    leds[col2pos(1, code[1] - '0')] = CRGB(255, 0, 0);
    leds[col2pos(2, code[2] - '0')] = CRGB(255, 0, 0);
    leds[col2pos(3, code[3] - '0')] = CRGB(255, 0, 0);
    leds[col2pos(4, code[4] - '0')] = CRGB(255, 0, 0);
    leds[col2pos(5, code[5] - '0')] = CRGB(255, 0, 0);
  }
  if (delai + 1999 > millis()) {
    delai = millis();
  }
  FastLED.show();
}

void setup() {
  #ifdef VERBOSE
    Serial.begin(115200);
    delay(1000);
    Serial.println("Lixie starting");
  #endif
  startup = true;

  EEPROM.begin(EEPROM_SIZE);
  
  for (int i = 0; i < 33; i++) {
      ssid[i] = EEPROM.read(0 + i);
  }
  for (int i = 0; i < 64; i++) {
      password[i] = EEPROM.read(34 + i);
  }
  for (int i = 0; i < 256; i++) {
      raw_data_src[i] = EEPROM.read(98 + i);
  }
  
  #ifdef VERBOSE
    Serial.printf("SSID: %s\nPSWD: %s\nRAWD: %s\n", ssid, password, raw_data_src);
  #endif
  FastLED.addLeds<NEOPIXEL, DATA_PIN>(leds, NUM_LEDS);  // GRB ordering is assumed
  //FastLED.addLeds<WS2812B, DATA_PIN, RGB>(leds, NUM_LEDS);  // GRB ordering is typical
  pinMode(2, OUTPUT);
  
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("LixieClock", "makecode");
  //WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  
  // if DNSServer is started with "*" for domain name, it will reply with
  // provided IP to all DNS request
  dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
    int paramsNr = request->params();
    for(int i = 0; i < paramsNr; i++){
        AsyncWebParameter* p = request->getParam(i);
        char _name[33];
        char _value[256];
        p->name().toCharArray(_name, 31);
        p->value().toCharArray(_value, 255);
        _name[32] = '\0';
        _value[255] = '\0';
        
        if (! strcmp(_name, "SSID")) {
          if (strncmp(_value, ssid, 32)) {
            #ifdef VERBOSE
              Serial.printf("Updating EEPROM for SSID \n%s\n%s\n-----\n", ssid, _value);
            #endif
            strncpy(ssid, _value, 32);
            ssid[32] = '\0';
            for (int i = 0; i < 33; i++) {
              update_eeprom(0 + i, ssid[i]);
            }
            EEPROM.commit();
          }
        }
        else if (! strcmp(_name, "PSWD")) {
          if (strncmp(_value, password, 63)) {
            #ifdef VERBOSE
              Serial.printf("Updating EEPROM for PASSWORD \n%s\n%s\n-----\n", password, _value);
            #endif
            strncpy(password, _value, 63);
            password[63] = '\0';
            for (int i = 0; i < 64; i++) {
              update_eeprom(34 + i, password[i]);
            }
            EEPROM.commit();
          }
        }
        else if (! strcmp(_name, "RAWDATA")) {
          if (strncmp(_value, raw_data_src, 63)) {
            #ifdef VERBOSE
              Serial.printf("Updating EEPROM for RAWDATA \n%s\n%s\n-----\n", raw_data_src, _value);
            #endif
            strncpy(raw_data_src, _value, 255);
            raw_data_src[255] = '\0';
            for (int i = 0; i < 256; i++) {
              update_eeprom(98 + i, raw_data_src[i]);
            }
            EEPROM.commit();
          }
        }
        #ifdef VERBOSE
          Serial.print("Param name: ");
          Serial.println(_name);
          Serial.print("Param value: ");
          Serial.println(_value);
          Serial.println("------");
        #endif
    }
    AsyncResponseStream *response = request->beginResponseStream("text/html");
    response->printf("<title>LixieClock</title><h1>Lixie Clock</h1>");
    response->printf("<form>SSID : <input type='text' name='SSID' value='%s'/><br>", ssid);
    response->printf("PASSWORD : <input type='text' name='PSWD' value='%s'/><br>", password);
    response->printf("RAW DATA SOURCE : <input type='text' name='RAWDATA' value='%s'/><br>", raw_data_src);
    response->printf("<input type='submit'></form>");
    request->send(response);
  });
  server.begin();

  #ifdef VERBOSE
    Serial.printf("Connecting to |%s| with password |%s| ", ssid, password);
  #endif
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED && (now + 60000) > millis()) {
    delay(500);
    #ifdef VERBOSE
      Serial.print(".");
    #endif
  }
  if(WiFi.status() != WL_CONNECTED) {
    #ifdef VERBOSE
      Serial.println("Not connected");
    #endif
  }
  else {
    #ifdef VERBOSE
      Serial.println("Connected");
    #endif
  }
  now = millis();
  delai = millis();
}

void loop() {
  if (startup) {
    dnsServer.processNextRequest();
    
    if (millis() > 300000) {
      WiFi.softAPdisconnect (true);
      dnsServer.stop();
      startup = false;
    }
  }

  if (now + 999 < millis()) {
    now = millis();
    #ifdef VERBOSE
      Serial.println(now);
    #endif
    HTTPClient http;
    http.begin(raw_data_src);  //Specify the URL
    int httpCode = http.GET(); //Make the request
    if (int(httpCode/100) == 2) {
        String payload = http.getString();
        #ifdef VERBOSE
          Serial.println(httpCode);
          Serial.println(payload);
          Serial.println(payload.length());
        #endif
        if (payload.length() == 31) {
          heure = atoi(&(payload[11]));
          minute = atoi(&(payload[14]));
          seconde = atoi(&(payload[17]));
          couleurs[0] = atoi(&(payload[20]));
          couleurs[1] = atoi(&(payload[24]));
          couleurs[2] = atoi(&(payload[28]));
          afficher_heure();
        }
        else {
          afficher_erreur("000406");
        }
    }
    else {
      #ifdef VERBOSE
        Serial.println("Error on HTTP request");
        Serial.println(httpCode);
        Serial.println(int(httpCode/100));
      #endif
      afficher_erreur("000404");
    }
    http.end();
  }
  
}
