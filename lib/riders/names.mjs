// Curated fictional name combinations, not a list of real cyclists.
// Regional fallbacks deliberately use one coherent naming tradition at a time.
const pool = (M,F,last,extra={}) => ({M:M.split('|'),F:F.split('|'),last:last.split('|'),middle:.24,...extra});
export const namePools = {
  danish:pool('Emil|Mikkel|Søren|Frederik|Anders|Rasmus|Viktor|Magnus','Emma|Freja|Sofie|Clara|Ida|Astrid|Alma|Laura','Nielsen|Larsen|Madsen|Jensen|Lund|Holm|Møller|Kjær'),
  swedish:pool('Emil|Alexander|Erik|Oscar|Viktor|Albin|Elias|Gustav','Linnea|Sofia|Elin|Astrid|Elsa|Maja|Agnes|Ebba','Berg|Lind|Lindström|Andersson|Sjöberg|Nyström|Ek|Sundberg'),
  norwegian:pool('Sindre|Eirik|Magnus|Henrik|Olav|Jonas','Ingrid|Nora|Thea|Solveig|Liv|Marte','Hagen|Berg|Dahl|Solberg|Haugen|Lunde'),
  finnish:pool('Eero|Lauri|Mikko|Jussi|Antti|Oskari','Aino|Iida|Emmi|Sanni|Helmi|Veera','Korhonen|Virtanen|Nieminen|Laine|Heikkinen|Lehtinen'),
  icelandic:pool('Jón|Aron|Einar|Ólafur|Bjarni|Haukur','Anna|Katrín|Elín|Sara|Hekla|Freyja','Jónsson|Einarsson|Ólafsson|Arnarson|Bjarnason|Hauksson',{lastF:['Jónsdóttir','Einarsdóttir','Ólafsdóttir','Arnardóttir','Bjarnadóttir','Hauksdóttir']}),
  french:pool('Louis|Jules|Hugo|Antoine|Maxime|Adrien|Mathis|Rémi','Camille|Léa|Juliette|Manon|Élodie|Chloé|Inès|Margot','Laurent|Moreau|Garnier|Rousseau|Dubois|Marchand|Morel|Petit'),
  dutch:pool('Daan|Bram|Koen|Thijs|Jasper|Stijn|Floris|Niels','Lotte|Femke|Sanne|Maartje|Anouk|Eva|Fleur|Pien','de Vries|Bakker|Visser|van Dijk|Smit|de Boer|van der Meer|de Wit'),
  flemish:pool('Wout|Seppe|Mathis|Jarne|Jens|Pieter','Lotte|Lieselot|Noor|Elise|Fien|Hanne','De Smet|Peeters|Claes|Jacobs|Willems|Vermeulen'),
  german:pool('Felix|Jonas|Lukas|Leon|Niklas|Moritz|Florian|Anton','Hannah|Lena|Frieda|Mia|Johanna|Luisa|Leonie|Greta','Weber|Fischer|Becker|Hoffmann|Koch|Wagner|Schmidt|Keller'),
  italian:pool('Luca|Matteo|Lorenzo|Davide|Marco|Alessio|Andrea|Filippo','Giulia|Chiara|Francesca|Elena|Valentina|Alessia|Martina|Silvia','Rossi|Romano|Conti|Galli|Costa|Ferrari|Bellini|Moretti'),
  spanish:pool('Pablo|Diego|Álvaro|Javier|Adrián|Sergio|Mateo|Andrés','Lucía|Carmen|Elena|Alba|Marta|Isabel|Valeria|Mariana','García|Romero|Santos|Navarro|Torres|Vega|Rojas|Ramírez'),
  portuguese:pool('João|Tiago|Diogo|Pedro|Rafael|Miguel','Mariana|Inês|Beatriz|Leonor|Sofia|Joana','Silva|Santos|Ferreira|Pereira|Oliveira|Costa'),
  english:pool('Oliver|George|Harry|Thomas|James|Callum|Ethan|Noah','Alice|Emily|Charlotte|Grace|Eleanor|Lucy|Amelia|Isla','Wilson|Taylor|Bennett|Clarke|Turner|Hughes|Morgan|Reed'),
  irish:pool('Cian|Oisín|Conor|Finn|Liam|Darragh','Aoife|Niamh|Saoirse|Ciara|Orla|Aisling','Murphy|Kelly|Byrne|Walsh|Ryan|Doyle'),
  slovenian:pool('Luka|Matej|Jan|Žan|Rok|Nejc','Nika|Urška|Eva|Tina|Maja|Sara','Novak|Kovač|Krajnc|Zupan|Mlakar|Kos'),
  polish:pool('Jakub|Jan|Piotr|Adam|Michał|Kacper','Zofia|Julia|Maja|Alicja|Natalia|Oliwia','Kowalski|Wiśniewski|Kamiński|Zieliński|Lewandowski|Szymański',{lastF:['Kowalska','Wiśniewska','Kamińska','Zielińska','Lewandowska','Szymańska']}),
  czech:pool('Jan|Tomáš|Jakub|Pavel|Martin|Lukáš','Tereza|Eliška|Anna|Lucie|Kateřina|Adéla','Novák|Svoboda|Dvořák|Procházka|Kučera|Veselý',{lastF:['Nováková','Svobodová','Dvořáková','Procházková','Kučerová','Veselá']}),
  balkan:pool('Luka|Marko|Nikola|Stefan|Ivan|Petar','Ana|Milica|Jelena|Ivana|Mila|Sara','Jovanović|Petrović|Nikolić|Ilić|Popović|Kovačević',{middle:.08}),
  albanian:pool('Arben|Dritan|Ilir|Blerim|Luan|Besnik','Elira|Arta|Drita|Besa|Luljeta|Anisa','Hoxha|Leka|Dervishi|Krasniqi|Gashi|Berisha',{middle:.08}),
  romanian:pool('Andrei|Alexandru|Mihai|Ștefan|Vlad|Radu','Elena|Ioana|Andreea|Maria|Ana|Daria','Popescu|Ionescu|Popa|Dumitrescu|Stan|Marin'),
  hungarian:pool('Bence|Máté|Levente|Dániel|Ádám|Balázs','Anna|Hanna|Réka|Lili|Zsófia|Eszter','Nagy|Kovács|Tóth|Szabó|Varga|Kiss',{order:'family-first',middle:.12}),
  greek:pool('Nikos|Giorgos|Dimitris|Alexandros|Kostas|Petros','Maria|Eleni|Sofia|Katerina|Dimitra|Anna','Nikolaidis|Papadopoulos|Georgiou|Dimitriou|Ioannou|Pappas',{lastF:['Nikolaidi','Papadopoulou','Georgiou','Dimitriou','Ioannou','Pappa'],middle:.08}),
  baltic:pool('Jānis|Andris|Māris|Edgars|Artūrs|Rihards','Anna|Ilze|Laura|Elīna|Marta|Līga','Bērziņš|Kalniņš|Ozols|Liepiņš|Krūmiņš|Balodis',{lastF:['Bērziņa','Kalniņa','Ozola','Liepiņa','Krūmiņa','Balode'],middle:.08}),
  estonian:pool('Jaan|Rasmus|Karl|Siim|Mart|Tanel','Liis|Kaisa|Maarja|Kertu|Kadri|Annika','Tamm|Saar|Sepp|Mägi|Kask|Kukk',{middle:.1}),
  lithuanian:pool('Jonas|Mantas|Lukas|Tomas|Domas|Paulius','Ieva|Austėja|Ugnė|Gabija|Rūta|Eglė','Kazlauskas|Petrauskas|Jankauskas|Stankevičius|Paulauskas|Vasiliauskas',{lastF:['Kazlauskaitė','Petrauskaitė','Jankauskaitė','Stankevičiūtė','Paulauskaitė','Vasiliauskaitė'],middle:.08}),
  russian:pool('Ivan|Dmitri|Alexei|Mikhail|Pavel|Nikolai','Anna|Elena|Daria|Olga|Irina|Natalia','Ivanov|Petrov|Smirnov|Sokolov|Volkov|Morozov',{lastF:['Ivanova','Petrova','Smirnova','Sokolova','Volkova','Morozova'],middle:0}),
  ukrainian:pool('Oleksandr|Dmytro|Andrii|Bohdan|Maksym|Taras','Olena|Oksana|Kateryna|Iryna|Sofiia|Yuliia','Shevchenko|Kovalenko|Bondarenko|Tkachenko|Kravchenko|Melnyk',{middle:0}),
  turkish:pool('Emre|Can|Deniz|Kerem|Arda|Mert','Elif|Zeynep|Defne|Ece|Derya|Selin','Yılmaz|Kaya|Demir|Şahin|Çelik|Yıldız'),
  georgian:pool('Giorgi|Davit|Luka|Nika|Levan|Saba','Nino|Mariam|Ana|Tamar|Salome|Lika','Beridze|Kapanadze|Gelashvili|Maisuradze|Lomidze|Kobakhidze',{middle:0}),
  armenian:pool('Aram|Hayk|Tigran|Levon|Gor|David','Ani|Nare|Anahit|Mariam|Lilit|Sona','Sargsyan|Grigoryan|Hakobyan|Harutyunyan|Petrosyan|Gevorgyan',{middle:0}),
  arabic:pool('Omar|Yusuf|Karim|Sami|Amir|Tariq','Layla|Nour|Salma|Amira|Lina|Mariam','Haddad|Nasser|Mansour|Saleh|Khalil|Hamdan'),
  persian:pool('Arman|Reza|Navid|Amir|Kian|Dariush','Sara|Neda|Shirin|Mina|Parisa|Roya','Karimi|Rahimi|Ahmadi|Hosseini|Moradi|Azizi',{middle:.08}),
  hebrew:pool('Noam|Eitan|Ari|Idan|Lior|Yonatan','Tamar|Yael|Maya|Noa|Shira|Talia','Cohen|Levi|Mizrahi|Peretz|Shapiro|Friedman'),
  centralAsian:pool('Azamat|Timur|Daniyar|Rustam|Alim|Marat','Aida|Amina|Madina|Aliya|Zarina|Dinara','Karimov|Akhmetov|Yusupov|Rakhimov|Ismailov|Sultanov',{lastF:['Karimova','Akhmetova','Yusupova','Rakhimova','Ismailova','Sultanova'],middle:0}),
  indian:pool('Arjun|Rohan|Vikram|Aditya|Rahul|Kiran','Ananya|Priya|Meera|Kavya|Aditi|Nisha','Sharma|Patel|Joshi|Rao|Mehta|Desai',{middle:.12}),
  bengali:pool('Arif|Rafiq|Tanvir|Hasan|Imran|Nabil','Farhana|Nusrat|Ayesha|Samira|Taslima|Rima','Rahman|Ahmed|Hasan|Chowdhury|Islam|Haque',{middle:.12}),
  nepali:pool('Suman|Bikash|Prakash|Anil|Rajesh|Deepak','Sita|Mina|Anita|Sunita|Puja|Bina','Shrestha|Gurung|Rai|Thapa|Tamang|Karki',{middle:.08}),
  sriLankan:pool('Kasun|Nuwan|Lahiru|Dinesh|Chamath|Isuru','Nimali|Sanduni|Dilini|Tharushi|Chamari|Hasini','Perera|Fernando|Silva|Jayasinghe|Bandara|Senanayake',{middle:.08}),
  japanese:pool('Haruto|Ren|Yuto|Sota|Takumi|Kaito','Haruka|Yui|Aoi|Sakura|Hina|Misaki','Mori|Sato|Suzuki|Tanaka|Watanabe|Ito',{order:'family-first',middle:0}),
  korean:pool('Min-jun|Seo-jun|Ji-ho|Do-yun|Hyun-woo|Jun-seo','Seo-yeon|Ji-woo|Ha-eun|Min-seo|Su-bin|Ye-jin','Kim|Lee|Park|Choi|Jung|Kang',{order:'family-first',middle:0}),
  chinese:pool('Wei|Jun|Hao|Ming|Tao|Lei','Mei|Xinyi|Yue|Jing|Xia|Ying','Wang|Li|Zhang|Liu|Chen|Yang',{order:'family-first',middle:0}),
  vietnamese:pool('Minh|Duc|Huy|Nam|Duy|Quang','Linh|Mai|Lan|Thao|Hoa|Trang','Nguyen|Tran|Le|Pham|Hoang|Phan',{order:'family-first',middle:.5,middleM:['Van','Quoc','Thanh'],middleF:['Thi','Ngoc','Thanh']}),
  thai:pool('Somchai|Anan|Niran|Kittisak|Chai|Prasert','Siriporn|Malee|Kanya|Naree|Anong|Pim','Srisai|Wongchai|Saetang|Boonmee|Sukjai|Jaidee',{middle:0}),
  khmer:pool('Sokha|Dara|Vuthy|Sophal|Rith|Visal','Sophea|Bopha|Sreyneang|Malis|Rachana|Kanika','Sok|Chan|Chea|Kim|Heng|Lim',{order:'family-first',middle:0}),
  malay:pool('Amir|Hakim|Farid|Rizal|Azlan|Hafiz','Aisyah|Nurul|Siti|Farah|Nadia|Aina','Rahman|Ismail|Abdullah|Hassan|Ibrahim|Yusof',{middle:0}),
  indonesian:pool('Aditya|Budi|Dimas|Arif|Bayu|Rizky','Ayu|Dewi|Putri|Sari|Rina|Wulan','Pratama|Saputra|Wijaya|Santoso|Kurniawan|Setiawan',{middle:0}),
  filipino:pool('Miguel|Paolo|Carlo|Rafael|Luis|Gabriel','Maria|Isabel|Angelica|Camille|Bea|Andrea','Santos|Reyes|Cruz|Bautista|Ramos|Mendoza'),
  burmese:pool('Aung|Min|Kyaw|Zaw|Htet|Ye','Thiri|Su|May|Khin|Ei|Nwe','Hlaing|Win|Tun|Myint|Naing|Soe',{middle:0,structure:'compound'}),
  mongolian:pool('Bat|Bataa|Temuulen|Enkh|Ganbold|Bilegt','Nomin|Anu|Sarnai|Bolormaa|Enkhjin|Solongo','Batbayar|Enkhbat|Ganbaatar|Bold|Munkh|Dorj',{order:'family-first',middle:0}),
  tibetan:pool('Tenzin|Karma|Dorji|Pema|Sonam|Jigme','Pema|Sonam|Deki|Choden|Yangchen|Tshering','Wangchuk|Dorji|Tashi|Gyatso|Norbu|Lhamo',{middle:0,structure:'compound'}),
  horn:pool('Dawit|Yonas|Samuel|Biniam|Abel|Natnael','Saba|Selam|Hana|Meron|Rahel|Senait','Tesfay|Girma|Haile|Tekle|Berhe|Gebre',{middle:0,structure:'patronymic'}),
  somali:pool('Abdi|Hassan|Farah|Mohamed|Omar|Yusuf','Amina|Hodan|Fadumo|Sahra|Hibo|Nimo','Ali|Ahmed|Hussein|Osman|Ibrahim|Nur',{middle:.35,structure:'patronymic'}),
  westAfrican:pool('Mamadou|Ibrahima|Moussa|Ousmane|Amadou|Seydou','Aminata|Fatou|Awa|Mariama|Adama|Binta','Diallo|Sow|Ba|Ndiaye|Diop|Traoré',{middle:.08}),
  ghanaian:pool('Kwame|Kofi|Kwesi|Yaw|Kojo|Kwaku','Ama|Akua|Abena|Yaa|Afia|Akosua','Mensah|Owusu|Boateng|Osei|Asante|Agyeman',{middle:.15}),
  yoruba:pool('Tunde|Babatunde|Akin|Femi|Kunle|Segun','Bisi|Funmi|Yetunde|Bola|Sade|Temi','Adeyemi|Adebayo|Ogunleye|Olawale|Afolabi|Balogun',{middle:.15}),
  centralAfrican:pool('Jean|Patrick|Alain|Joseph|Emmanuel|Christian','Marie|Chantal|Esther|Grace|Aline|Jeanne','Mbala|Ilunga|Kabeya|Mbuyi|Kasongo|Kalala',{middle:.1}),
  eastAfrican:pool('Baraka|Juma|Hamisi|Rashid|Salim|Omari','Asha|Neema|Rehema|Zawadi|Amina|Subira','Mwangi|Kamau|Juma|Hassan|Otieno|Njoroge',{middle:.12}),
  rwandan:pool('Jean|Eric|Patrick|Emmanuel|Samuel|Olivier','Diane|Alice|Claudine|Aline|Josiane|Chantal','Uwimana|Niyonzima|Habimana|Ishimwe|Mugisha|Ndayishimiye',{middle:0}),
  southernAfrican:pool('Sipho|Themba|Thabo|Bongani|Mandla|Sibusiso','Nomsa|Lindiwe|Thandi|Zanele|Nandi|Bongiwe','Dlamini|Ndlovu|Nkosi|Mokoena|Khumalo|Zulu',{middle:.15}),
  malagasy:pool('Andry|Hery|Rado|Faly|Tiana|Toky','Fara|Miora|Hasina|Lalao|Voahirana|Sahondra','Rakoto|Rasoa|Rakotomalala|Rabe|Rajaona|Randria',{middle:0}),
  pacific:pool('Tavita|Sione|Manu|Tane|Mika|Ioane','Mele|Lani|Sina|Moana|Ana|Leilani','Tui|Fale|Latu|Manu|Vea|Ofa',{middle:.12}),
};

// Explicit coverage: no silent worldwide English fallback. Multiple traditions
// within a country are sampled independently of appearance.
const groups = {
  danish:'DK FO GL',swedish:'SE',norwegian:'NO SJ',finnish:'FI AX',icelandic:'IS',
  french:'FR MC RE GP MQ GF PM BL MF',dutch:'NL AW CW BQ SX',flemish:'BE',german:'DE AT LI CH LU',italian:'IT SM VA MT',
  spanish:'ES AD AR BO CL CO CR CU DO EC SV GQ GT HN MX NI PA PY PE PR UY VE',portuguese:'PT BR AO CV GW MZ ST TL',
  english:'GB US AU NZ CA AG AI BS BB BZ BM KY DM FK GD GI GU GY JM MS MP NF KN LC VC TT TC VG VI',irish:'IE',
  slovenian:'SI',polish:'PL',czech:'CZ SK',balkan:'RS HR BA ME MK BG',albanian:'AL XK',romanian:'RO MD',hungarian:'HU',greek:'GR CY',
  baltic:'LV',estonian:'EE',lithuanian:'LT',russian:'RU BY',ukrainian:'UA',turkish:'TR AZ',georgian:'GE',armenian:'AM',
  arabic:'DZ BH EG IQ JO KW LB LY MA MR OM PS QA SA SD SY TN AE EH',persian:'IR AF',hebrew:'IL',centralAsian:'KZ KG UZ TJ TM',
  indian:'IN PK MV MU',bengali:'BD',nepali:'NP',sriLankan:'LK',japanese:'JP',korean:'KR KP',chinese:'CN TW HK MO SG',
  vietnamese:'VN',thai:'TH LA',khmer:'KH',malay:'MY BN CC',indonesian:'ID CX',filipino:'PH',burmese:'MM',mongolian:'MN',tibetan:'BT',
  horn:'ER ET',somali:'SO DJ',westAfrican:'SN GM GN ML BF NE',ghanaian:'GH TG CI',yoruba:'NG BJ',
  centralAfrican:'CM CF CG CD GA TD',eastAfrican:'KE TZ UG SS KM SC YT',rwandan:'RW BI',
  southernAfrican:'ZA BW LS SZ NA ZM ZW MW',malagasy:'MG',pacific:'FJ PG SB VU WS TO TV KI NR PW FM MH CK NU PF NC WF AS TK',
};
export const traditionsByCountry = Object.fromEntries(Object.entries(groups).flatMap(([key,codes])=>codes.split(' ').map(code=>[code,[key]])));
Object.assign(traditionsByCountry,{
  BE:['flemish','flemish','french'],CH:['german','german','french','italian'],LU:['german','french'],CA:['english','english','french'],
  ZA:['southernAfrican','southernAfrican','english','dutch'],SG:['chinese','chinese','malay','indian'],
  NZ:['english','english','pacific'],HT:['french'],LR:['english'],SL:['english'],SH:['english'],
  PK:['persian','arabic'],YE:['arabic'],PN:['english'],SR:['dutch','indian'],GG:['english'],IM:['english'],JE:['english'],
});

export function generateName(country,gender,random) {
  const pick = items => items[Math.floor(random()*items.length)];
  const traditions=traditionsByCountry[country];
  if(!traditions) throw new Error(`Missing naming tradition: ${country}`);
  const tradition=pick(traditions), p=namePools[tradition];
  const first=pick(p[gender]), last=pick(gender==='F'&&p.lastF?p.lastF:p.last);
  const middle=random()<p.middle?pick((p[`middle${gender}`]||p[gender]).filter(n=>n!==first)):null;
  const parts=p.order==='family-first'?[last,middle,first]:[first,middle,last];
  return {first_name:first,middle_name:middle,last_name:last,display_name:parts.filter(Boolean).join(' '),name_tradition:tradition};
}
