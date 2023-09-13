import fs from 'fs'

function addToJSON(data){
  const output_file = 'ws_output_m1.json'
  let outputjson = fs.readFileSync(output_file, "utf-8");
  if (outputjson === '') {
    outputjson = '[]'
  }
  let result = JSON.parse(outputjson)
  // console.log("outputFile", result)
  data['test_no'] = result.length
  result.push(data)
  fs.writeFileSync(output_file, JSON.stringify(result, null, 2), 'utf-8')

}

export default addToJSON