#include "simulator.h"
#include "stl_support.h"
/***************************************************************************
 *   Copyright (C) 2010 by santiago González                               *
 *   santigoro@gmail.com                                                   *
 *                                                                         *
 *   This program is free software; you can redistribute it and/or modify  *
 *   it under the terms of the GNU General Public License as published by  *
 *   the Free Software Foundation; either version 3 of the License, or     *
 *   (at your option) any later version.                                   *
 *                                                                         *
 *   This program is distributed in the hope that it will be useful,       *
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of        *
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the         *
 *   GNU General Public License for more details.                          *
 *                                                                         *
 *   You should have received a copy of the GNU General Public License     *
 *   along with this program; if not, see <http://www.gnu.org/licenses/>.  *
 *                                                                         *
 ***************************************************************************/

// Qt-free adapter for the upstream function component. Source notices are
// retained by the extraction script. Expressions are pure and resource-bounded.
#include "e-function.h"
#include "simulator.h"
eFunction::eFunction(Simulator& sim,std::string id):eLogicDevice(sim,id){}
eFunction::~eFunction()=default;
void eFunction::stamp(){eLogicDevice::stamp();for(auto* input:m_input)if(auto* node=input->getEpin()->getEnode())node->addToChangedFast(this);}
void eFunction::setVChanged(){
 if(m_expressions.size()!=size_t(m_numOutputs))throw std::invalid_argument("EXPRESSION_OUTPUT_COUNT");
 auto variable=[&](const std::string& name)->double {
  bool voltage=name.size()>1&&name[0]=='v';std::string pin=voltage?name.substr(1):name;
  if(pin.size()<2||(pin[0]!='i'&&pin[0]!='o')||!std::all_of(pin.begin()+1,pin.end(),[](char c){return c>='0'&&c<='9';}))throw std::invalid_argument("EXPRESSION_VARIABLE");
  unsigned n=std::stoul(pin.substr(1));bool input=pin[0]=='i';auto& pins=input?m_input:m_output;if(n>=pins.size())throw std::invalid_argument("EXPRESSION_PIN_RANGE");
  return voltage?pins[n]->getEpin()->getVolt():input?getInputState(n):getOutputState(n);
 };
 std::vector<double> result;for(auto& expression:m_expressions)result.push_back(expression.evaluate(variable));
 for(size_t i=0;i<result.size();++i){if(m_funcList[i].rfind("vo",0)==0){m_output[i]->setVoltHigh(result[i]);setOut(i,true);}else setOut(i,result[i]!=0);}
}
std::string eFunction::functions(){return m_functions;}
void eFunction::setFunctions(std::string functions){
 std::vector<std::string> list;size_t start=0;int depth=0;
 for(size_t i=0;i<=functions.size();++i){char c=i<functions.size()?functions[i]:',';if(c=='(')++depth;if(c==')')--depth;if(c==','&&depth==0){list.push_back(functions.substr(start,i-start));start=i+1;}}
 std::vector<ws::Expression> parsed;
 for(auto text:list){auto equal=text.find('=');if(text.rfind("vo",0)==0&&equal!=text.npos&&text[equal+1]!='=')text=text.substr(equal+1);parsed.emplace_back(text);}
 m_functions=std::move(functions);m_funcList=std::move(list);m_expressions=std::move(parsed);
}
