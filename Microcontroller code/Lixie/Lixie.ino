//#define VERBOSE

const char* ssid       = "SSID-HERE";
const char* password   = "PASSWORD-HERE";

#include <WiFi.h>
#include <DNSServer.h>

#define DNS_PORT 53
IPAddress apIP(8,8,4,4); // The default android DNS
DNSServer dnsServer;
WiFiServer server(80);

String responseHTML = ""
  "<!DOCTYPE html><html><head><title>CaptivePortal</title></head><body>"
  "<h1>Hello World!</h1><p>This is a captive portal example. All requests will "
  "be redirected here.</p></body></html>";

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
bool startup;

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

void setup() {
  #ifdef VERBOSE
    Serial.begin(115200);
    delay(1000);
    Serial.println("Lixie starting");
  #endif
  startup = true;

    FastLED.addLeds<NEOPIXEL, DATA_PIN>(leds, NUM_LEDS);  // GRB ordering is assumed
    //FastLED.addLeds<WS2812B, DATA_PIN, RGB>(leds, NUM_LEDS);  // GRB ordering is typical
    pinMode(2, OUTPUT);
  
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("LixieClock", "makecode");
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  
  // if DNSServer is started with "*" for domain name, it will reply with
  // provided IP to all DNS request
  dnsServer.start(DNS_PORT, "*", apIP);

  server.begin();

  now = millis();
  #ifdef VERBOSE
    Serial.printf("Connecting to %s ", ssid);
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
}

void loop() {
  if (startup) {
    dnsServer.processNextRequest();
    WiFiClient client = server.available();   // listen for incoming clients
  
    if (client) {
      String currentLine = "";
      while (client.connected()) {
        if (client.available()) {
          char c = client.read();
          if (c == '\n') {
            if (currentLine.length() == 0) {
              client.println("HTTP/1.1 200 OK");
              client.println("Content-type:text/html");
              client.println();
              client.print(responseHTML);
              break;
            } else {
              currentLine = "";
            }
          } else if (c != '\r') {
            currentLine += c;
          }
        }
      }
      client.stop();
    }
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
    http.begin("http://lixie.cyrillekasyc.fr/raw");  //Specify the URL
    int httpCode = http.GET();                       //Make the request
    if (httpCode > 0) { //Check for the returning code
        String payload = http.getString();
        #ifdef VERBOSE
          Serial.println(httpCode);
          Serial.println(payload);
        #endif
        heure = atoi(&(payload[11]));
        minute = atoi(&(payload[14]));
        seconde = atoi(&(payload[17]));
        couleurs[0] = atoi(&(payload[20]));
        couleurs[1] = atoi(&(payload[24]));
        couleurs[2] = atoi(&(payload[28]));

        afficher_heure();
    }
    else {
      #ifdef VERBOSE
        Serial.println("Error on HTTP request");
      #endif
    }
    http.end();
  }
  
}
