import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config()

function addToJSON(data){
  const output_file = 'ws_output.json'
  let outputjson = fs.readFileSync(output_file, "utf-8");
  if (outputjson === '') {
    outputjson = '[]'
  }
  let result = JSON.parse(outputjson)
  // const note = process.env.NOTE || ''
  // if(note !== ''){
  //   data['note'] = note
  // }
  // console.log("outputFile", result)
  data['test_no'] = result.length
  result.push(data)
  fs.writeFileSync(output_file, JSON.stringify(result, null, 2), 'utf-8')

}

export default addToJSON