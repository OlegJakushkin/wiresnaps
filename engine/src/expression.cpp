// SPDX-License-Identifier: GPL-3.0-or-later
#include "expression.h"
#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstdlib>
#include <map>
#include <stdexcept>
namespace ws {
Expression::Expression(const std::string& text){
 if(text.size()>4096)throw std::invalid_argument("EXPRESSION_SIZE");
 size_t at=0;std::string token;double number=0;
 auto next=[&]{while(at<text.size()&&std::isspace(static_cast<unsigned char>(text[at])))++at;token.clear();if(at==text.size())return;
  if(std::isdigit(static_cast<unsigned char>(text[at]))||text[at]=='.'){char* end;number=std::strtod(text.c_str()+at,&end);if(end==text.c_str()+at||!std::isfinite(number))throw std::invalid_argument("EXPRESSION_NUMBER");at=size_t(end-text.c_str());token="#";return;}
  if(std::isalpha(static_cast<unsigned char>(text[at]))||text[at]=='_'){size_t start=at++;while(at<text.size()&&(std::isalnum(static_cast<unsigned char>(text[at]))||text[at]=='_'||text[at]=='.'))++at;token=text.substr(start,at-start);if(token.rfind("Math.",0)==0)token=token.substr(5);return;}
  for(auto op:{"&&","||","==","!=","<=",">=","<<",">>","**"})if(text.compare(at,2,op)==0){token=op;at+=2;return;}
  token=text.substr(at++,1);
 };
 auto add=[&](std::string op,std::vector<unsigned> args={},double value=0.){if(nodes_.size()>=512)throw std::invalid_argument("EXPRESSION_BUDGET");nodes_.push_back({std::move(op),value,std::move(args)});return unsigned(nodes_.size()-1);};
 const std::map<std::string,int> prec={{"||",1},{"&&",2},{"|",3},{"^",4},{"&",5},{"==",6},{"!=",6},{"<",7},{">",7},{"<=",7},{">=",7},{"<<",8},{">>",8},{"+",9},{"-",9},{"*",10},{"/",10},{"%",10},{"**",11}};
 std::function<unsigned(int,unsigned)> parse;
 parse=[&](int minimum,unsigned depth)->unsigned{
  if(depth>32)throw std::invalid_argument("EXPRESSION_DEPTH");unsigned lhs;
  if(token=="#"){lhs=add("#",{},number);next();}
  else if(token=="(" ){next();lhs=parse(0,depth+1);if(token!=")")throw std::invalid_argument("EXPRESSION_PARENTHESIS");next();}
  else if(token=="+"||token=="-"||token=="!"||token=="~"){auto op=token;next();lhs=add("unary"+op,{parse(11,depth+1)});}
  else if(!token.empty()&&std::isalpha(static_cast<unsigned char>(token[0]))){auto name=token;next();if(token=="("){next();std::vector<unsigned> args;if(token!=")"){args.push_back(parse(0,depth+1));while(token==","){next();args.push_back(parse(0,depth+1));if(args.size()>3)throw std::invalid_argument("EXPRESSION_ARGUMENTS");}}if(token!=")")throw std::invalid_argument("EXPRESSION_PARENTHESIS");next();lhs=add("call:"+name,args);}else lhs=name=="true"||name=="false"?add("#",{},name=="true"):add("var:"+name);}
  else throw std::invalid_argument("EXPRESSION_SYNTAX");
  while(prec.count(token)&&prec.at(token)>=minimum){auto op=token;int p=prec.at(op);next();auto rhs=parse(p+(op=="**"?0:1),depth+1);lhs=add(op,{lhs,rhs});}
  if(minimum==0&&token=="?"){next();auto yes=parse(0,depth+1);if(token!=":")throw std::invalid_argument("EXPRESSION_CONDITIONAL");next();auto no=parse(0,depth+1);lhs=add("?:",{lhs,yes,no});}
  return lhs;
 };
 next();root_=parse(0,0);if(!token.empty())throw std::invalid_argument("EXPRESSION_TRAILING_TOKEN");
}
double Expression::evaluate(const std::function<double(const std::string&)>& variable) const {
 unsigned budget=1024;
 std::function<double(unsigned)> eval=[&](unsigned index)->double{
  if(!budget--)throw std::runtime_error("EXPRESSION_BUDGET");const auto& n=nodes_.at(index);const auto& op=n.op;double a=0,b=0,r=0;
  if(op=="#")return n.number;
  if(op.rfind("var:",0)==0){r=variable(op.substr(4));}
  else {
   if(!n.args.empty())a=eval(n.args[0]);
   if(op=="?:")return eval(n.args[a!=0?1:2]);
   if(op=="&&"&&a==0)return 0;if(op=="||"&&a!=0)return 1;
   if(n.args.size()>1)b=eval(n.args[1]);
   auto integer=[](double x)->int32_t{if(x<-2147483648.||x>2147483647.)throw std::runtime_error("EXPRESSION_INTEGER_RANGE");return int32_t(x);};
   if(op=="+")r=a+b;else if(op=="-")r=a-b;else if(op=="*")r=a*b;else if(op=="/"){if(b==0)throw std::runtime_error("EXPRESSION_DIVIDE_BY_ZERO");r=a/b;}
   else if(op=="%")r=std::fmod(a,b);else if(op=="**")r=std::pow(a,b);
   else if(op=="<")r=a<b;else if(op==">")r=a>b;else if(op=="<=")r=a<=b;else if(op==">=")r=a>=b;else if(op=="==")r=a==b;else if(op=="!=")r=a!=b;
   else if(op=="&&")r=a!=0&&b!=0;else if(op=="||")r=a!=0||b!=0;
   else if(op=="&")r=integer(a)&integer(b);else if(op=="|")r=integer(a)|integer(b);else if(op=="^")r=integer(a)^integer(b);
   else if(op=="<<")r=int32_t(uint32_t(integer(a))<<(uint32_t(integer(b))&31));else if(op==">>")r=integer(a)>>(uint32_t(integer(b))&31);
   else if(op=="unary+")r=a;else if(op=="unary-")r=-a;else if(op=="unary!")r=a==0;else if(op=="unary~")r=~integer(a);
   else if(op=="call:min"&&n.args.size()==2)r=std::min(a,b);else if(op=="call:max"&&n.args.size()==2)r=std::max(a,b);else if(op=="call:pow"&&n.args.size()==2)r=std::pow(a,b);
   else if(n.args.size()==1){if(op=="call:abs")r=std::abs(a);else if(op=="call:sqrt")r=std::sqrt(a);else if(op=="call:sin")r=std::sin(a);else if(op=="call:cos")r=std::cos(a);else if(op=="call:tan")r=std::tan(a);else if(op=="call:exp")r=std::exp(a);else if(op=="call:log")r=std::log(a);else if(op=="call:floor")r=std::floor(a);else if(op=="call:ceil")r=std::ceil(a);else throw std::invalid_argument("EXPRESSION_FUNCTION");}
   else throw std::invalid_argument("EXPRESSION_FUNCTION");
  }
  if(!std::isfinite(r)||std::abs(r)>1e12)throw std::runtime_error("EXPRESSION_NON_FINITE");return r;
 };return eval(root_);
}
}
