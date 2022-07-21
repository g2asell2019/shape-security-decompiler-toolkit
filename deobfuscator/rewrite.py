import requests
import base64
class AddHeader:


    def response(self, flow):
        # if "ssx.mod.js?async" in flow.request.url:
            # flow.response.text = open("async.js").read()

        if "ssx.mod.js?seed=" in flow.request.url:
            
            session = requests.Session()
            session.trust_env = False

      
            
            flow.response.text = session.post("http://localhost:6969", json={'body': flow.response.text}).text
            # print(resp)

            # flow.response.text = open("manual.js").read() #resp.text
            

        
addons = [
    AddHeader()
]