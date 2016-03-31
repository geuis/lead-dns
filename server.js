'use strict';
// https://filterlists.com/

// probably should have a web aspect to accept corrections and recommendations
// some valid urls serve ads.

const fs = require('fs');
const FilterParser = require('abp-filter-parser');
const dns = require('native-dns');
const port = 53;
const realDnsServers = ['8.8.8.8'];

let allowedDomains = {
  'google.com': true,
  'arstechnica.com': true
};

// load urls to filter
let filterMap = {};
let filterListFile = fs.readFileSync('lists/easyprivacy+easylist.txt', 'utf-8')
  .split('\n')
  .forEach((line) => {
    if (line.indexOf('||') === 0) {
      // I hate regular expressions. If someone has a good one to do this, I'm
      // all ears.

      let end = line.indexOf('^');
      let end2 = line.indexOf('/');

      // ugh this sucks
      if (end !== -1) {
        // end = end;
      } else if (end2 !== -1) {
        end = end2;
      } else {
        end = -1;
      }

      let url = line.slice(2, end);
      
      if (!(url in allowedDomains)) {
        filterMap[line.slice(2, end)] = true
      }
       
    }
});



// comments start with !
// urls start with ||
// ||abasourdir.tech^$third-party
// ||lmgtfy.com/s/images/ls_
// ||myspacecdn.com/cms/*_skin_
// |http://$script,third-party,domain=primewire.ag|primewire.in
// @@||benswann.com/decor/javascript/magnify_stats.js?
// /advertiser.$domain=~advertiser.growmobile.com|~panel.rightflow.com
// ://adv.$domain=~adv.ru|~adv.vg|~advids.co|~farapp.com|~forex-tv-online.com|~typeform.com|~welaika.com
// /cdn-cgi/pe/bag2?r[]=*adk2.co
// ##a[href^="http://adfarm.mediaplex.com/"]

let server = dns.createServer();

server.on('request', (request, response) => {
  let proxyPromise = new Promise((resolve, reject) => {
    let questionLength = request.question.length;

    request.question.forEach((question) => {
      // check for domain in filter list here
      if (question.name in filterMap) {
        console.log(question);

        response.answer.push(question);
      } else {
        let proxyRequest = dns.Request({
          question: question,
          server: {
            // might want to randomize between multiple dns servers to spread load
            address: realDnsServers[0],
            port: 53,
            type: 'udp'
          },
          timeout: 10000
        });

        proxyRequest.on('message', (err, msg) => {
          if (err) {
            console.log('ERR:', err);
          }

          msg.answer.forEach((answer) => {
            response.answer.push(answer);
          });
          
          if (--questionLength === 0) {
            resolve();
          }
        });
        
        proxyRequest.send();
      }
    });
  });

  proxyPromise
    .then(() => {
      response.send();
    })
    .catch((err) => {
      console.log('ERR:', err);
      console.log('--------');
    });
});

server.serve(port);
