/**************************/
/* Début
/**************************/
let nip = "";
let statut = "";
let studentDep = "";
checkStatut();
document.querySelector("#notes")?.classList.add("navActif");
const INCONNU = 0;const ETUDIANT = 10;const PERSONNEL = 20;const ADMINISTRATEUR = 30;const SUPERADMINISTRATEUR = 40;/*********************************************/
/* Fonction de communication avec le serveur
Gère la déconnexion et les messages d'erreur
/*********************************************/
let config;
function fetchData(query){
document.querySelector(".wait").style.display = "flex";
let token = (window.location.search.match(/token=([a-zA-Z0-9._-]+)/)?.[1] || ""); // Récupération d'un token GET pour le passer au service

return fetch(
"/services/data.php?q="+query, 
{
method: "post",
headers: {
    "Content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Authorization": token ? "Bearer " + token : ""
}
}
)
.then(res => { return res.json() })
.then(function(data) {
document.querySelector(".wait").style.display = "none";
if(data.redirect){
// Utilisateur non authentifié, redirection vers une page d'authentification pour le CAS.
// Passage de l'URL courant au CAS pour redirection après authentification
window.location.href = data.redirect + "?href="+encodeURIComponent(window.location.href);
}
if(data.erreur){
// Il y a une erreur pour la récupération des données - affichage d'un message explicatif.
displayError(data.erreur);
}else{
if(data.config) {
    displayFromOptions(data.config);
}
return data;
}
})
.catch(error => {
document.querySelector(".wait").style.display = "none";
displayError("Une erreur s'est produite lors du transfert des données.");
throw 'Fin du script - données invalides';
})
}

function displayError(message){
let auth = document.querySelector(".auth");
auth.style.opacity = "1";
auth.style.pointerEvents = "initial";
auth.innerHTML = message;
auth.addEventListener("click", ()=>{
auth.style.opacity = "0";
auth.style.pointerEvents = "none";
}, { once: true })
}

function displayFromOptions(options){
config = options;
document.querySelector(".nom").innerText = config.name;

if(config.statut >= ETUDIANT) document.querySelector("body").classList.add('etudiant');
if(config.statut >= PERSONNEL) document.querySelector("body").classList.add('personnel');
if(config.statut >= ADMINISTRATEUR) document.querySelector("body").classList.add('admin');
if(config.statut >= SUPERADMINISTRATEUR) document.querySelector("body").classList.add('superadmin');

if(config.module_absences) document.querySelector("body").classList.add('moduleAbsences');
}/*********************************************/
/* Vérifie l'identité de la personne et son statut
/*********************************************/			
async function checkStatut(){
    let data = await fetchData("dataPremièreConnexion");

    nip = data.auth.session;
    statut = data.auth.statut;

    document.querySelector(".studentPic").src = "services/data.php?q=getStudentPic";
    let auth = document.querySelector(".auth");
    auth.style.opacity = "0";
    auth.style.pointerEvents = "none";

    if(data.auth.statut >= PERSONNEL){
        loadStudents(data.etudiants);
        let etudiant = (window.location.search.match(/ask_student=([a-zA-Z0-9._@-]+)/)?.[1] || "");
        if(etudiant){
            let input = document.querySelector("input");
            input.value = etudiant;
            loadSemesters(input);
        }
    } else {
        feedSemesters(data.semestres);
        showReportCards(data, data.semestres[data.semestres.length-1].formsemestre_id, data.auth.session);
        feedAbsences(data);
    }
    if(!config.etudiant_modif_photo) {
        document.querySelector("main>a").href = "#";
    }
    if(data.envoiDonneesVersion) {
        let url = "https://notes.iutmulhouse.uha.fr/services/getOthersData.php?";
        url += "name=" + location.host;
        url += "&passerelle_version=" + config.passerelle_version;
        url += "&acces_enseignants=" + config.acces_enseignants;
        url += "&module_absences=" + config.module_absences;
        url += "&data_absences_scodoc=" + config.data_absences_scodoc;
        url += "&autoriser_justificatifs=" + config.autoriser_justificatifs;

        fetch(url);
    }
}
/*********************************************/
/* Fonction pour les personnels 
Charge la liste d'étudiants pour en choisir un
/*********************************************/
function loadStudents(data){
    let output = "";
    data.forEach(function(e){
        output += `<option value='${e[0]}'>${e[1]}</option>`;
    });
    
    document.querySelector("#etudiants").innerHTML = output;
}

/*********************************************/
/* Charge les semestres d'un étudiant
Paramètre étudiant pour un personnel qui en choisit un
/*********************************************/
async function loadSemesters(input = ""){
    if(input){
        nip = input.value;
    }				
    let data = await fetchData("semestresEtudiant" + (input ? "&etudiant=" + nip : ""));
    feedSemesters(data, nip);
    document.querySelector(".semestres>label:nth-child(1)>div").click();
}

function feedSemesters(data, nip){
    let output = document.querySelector(".semestres");
    output.innerHTML = "";
    dep = data[data.length-1].titre;
    for(let i=data.length-1 ; i>=0 ; i--){
        let label = document.createElement("label");
        
        let input = document.createElement("input");
        input.type = "radio";
        input.name = "semestre";
        if(i==data.length-1){
            input.checked = true;
        }

        let vignette = document.createElement("div");
        vignette.innerHTML = `
            <div>${data[i].titre} - ${data[i].annee_scolaire}</div>
            <div>Semestre ${data[i].semestre_id}</div>
        `;
        vignette.dataset.semestre = data[i].formsemestre_id;
        vignette.addEventListener("click", getReportCards);

        label.appendChild(input);
        label.appendChild(vignette);
        output.appendChild(label);
    }

    if(statut >= 20){
        let url = window.location.origin + "/?ask_student=" + nip;
        let div = document.createElement("div");
        div.innerHTML = `<div style="width:100%; margin: 8px;">Lien pour accéder directement aux relevés : <a href=${url}>${url}</a></div>`;
        output.appendChild(div);
    }
}

/*********************************************/
/* Récupère et affiche le relevé de notes
/*********************************************/
async function getReportCards(){
    let semestre = this.dataset.semestre;
    let data = await fetchData("relevéEtudiant&semestre=" + semestre + ((nip && statut >= PERSONNEL) ? ("&etudiant=" + nip) : ""));

    showReportCards(data, semestre);
    feedAbsences(data);
}	

async function showReportCards(data, semestre){
    dep = data.relevé.etudiant.dept_acronym || data.relevé.etudiant.photo_url.split("/")[2];
    if(data.relevé.publie == false){
        document.querySelector(".releve").innerHTML = "<h2 style='background: #90c;'>" + data.relevé.message + "</h2>";
    }else if(data.relevé.type == "BUT"){
        let output = "";

        if(config.releve_PDF && (config.liste_dep_publi_PDF == "" || config.liste_dep_publi_PDF.split(",").includes(dep))) {
            output = `
            <form action="services/bulletin_PDF.php?type=BUT&sem_id=${semestre}&etudiant=${nip}" target="_blank" method="post">
                <button type="submit">Télécharger le relevé au format PDF</button>
            </form>`;

        }
        document.querySelector(".releve").innerHTML = output + "<releve-but></releve-but>";

        let releve = document.querySelector("releve-but");
        releve.config = {
            showURL: false
        }
        releve.showData = data.relevé;
        releve.shadowRoot.children[0].classList.add("hide_abs");

        /* Styles différent de Scodoc */
        let styles = document.createElement('link');
        styles.setAttribute('rel', 'stylesheet');
        styles.setAttribute('href', 'assets/styles/releve-but-custom.css');
        releve.shadowRoot.appendChild(styles);
                            /* Styles locaux */
        styles = document.createElement('style');
        styles.innerText = `/* Exemple pour masquer la partie synthèse : */
/*
.releve>section:nth-child(4) {
display: none;
}
*/`;
        releve.shadowRoot.appendChild(styles);
                            
        if(!document.body.classList.contains("personnel")){
            document.querySelector(".nom").innerText = data.relevé.etudiant.prenom.toLowerCase();
            releve.shadowRoot.querySelector(".studentPic").src = "services/data.php?q=getStudentPic";
        } else {
            releve.shadowRoot.querySelector(".studentPic").src = "services/data.php?q=getStudentPic&nip=" + nip;
        }
    } else {
        document.querySelector(".releve").innerHTML = "<releve-dut></releve-dut>";
        document.querySelector("releve-dut").showData = [data.relevé, semestre, nip];
                        }

    // Récupération et affichage du message département
    let message = await fetchData("getReportPageMessage&dep=" + dep);
    if(message.message) {
        let zoneMessage = document.querySelector(".depMessage");
        zoneMessage.style.display = "block";
        zoneMessage.querySelector("div").innerHTML = message.message;
    }
}

/*********************************************/
/* Affichage des absences
/*********************************************/
function feedAbsences(data){
    var totaux = {
        justifie: 0,
        absent: 0,
        retard: 0
    };
    let output = "";
    let multiJours = false;

    if(!config.afficher_absences) { return; }
    let depts = config.liste_dep_publi_absences;
    if  (! depts.split(",").includes(dep) && depts != '') { return; }

    document.querySelector(".message_rapport_absences").innerHTML = config.message_rapport_absences;
    document.querySelector(".absences").style.display = "block";

    if(config.autoriser_justificatifs && config.liste_dep_ok_justificatifs.split(",").includes(dep)) {
        document.querySelector(".depotJustif").href += "?nip=" + nip;
    } else {
        document.querySelector(".depotJustif").style.display = "none";
    }

    if(Object.entries(data.absences).length){
        Object.entries(data.absences).forEach(([date, listeAbsences])=>{
            listeAbsences.forEach(absence=>{
                if(absence.statut == "present"){
                    return;
                }
                if(absence.justifie == true || absence.justifie == "true"){
                    totaux.justifie += absence.fin - absence.debut;
                }else{
                    if(absence.statut == "retard") {
                        totaux[absence.statut] += 1;
                    } else {
                        totaux[absence.statut] += absence.fin - absence.debut;
                    }
                    
                }
                if(absence.dateFin && date != absence.dateFin){
                    var outputDate = date.split("-").reverse().join("/") 
                                    + " - " 
                                    + absence.dateFin.split("-").reverse().join("/");
                    multiJours = true;
                } else {
                    var outputDate = date.split("-").reverse().join("/");
                }
                output = `
                    <div>${outputDate}</div> 
                    <div>${floatToHour(absence.debut)} - ${floatToHour(absence.fin)}</div>
                    <div>${getMatiere(data, absence.matiereComplet)}</div>
                    <div class=enseignant>${absence.enseignant.split('@')[0].split(".").join(" ")}</div>
                    <div class="${(absence.justifie === true || absence.justifie === "true" ) ? "justifie" : absence.statut}"></div>
                ` + output;
            })
        })
    } else {
        output = `
            <div>/</div> 
            <div>/</div>
            <div>/</div>
            <div>/</div>
            <div>/</div>
        `
    }
    
    document.querySelector(".absences>.toutesAbsences").innerHTML = `
        <div class=entete>Date</div> 
        <div class=entete>Heures</div>
        <div class=entete>Matière</div>
        <div class=entete>Enseignant</div>
        <div class=entete>Statut</div>
    ` + output;

    /* Totaux */
    if(multiJours) {
        document.querySelector(".absences>.totauxAbsences").style.display = "none";
    } else {
        if(data.totauxAbsences) {	// totaux de Scodoc
            let txtType = {
                heure: "h",
                demi: " demi-journée(s)",
                journee: " journée(s)"
            }

            let totAbsent = data.totauxAbsences.absent.non_justifie[config.metrique_absences];
            let totJustifie = data.totauxAbsences.absent.justifie[config.metrique_absences];

            var txtJustifie = totJustifie + txtType[config.metrique_absences];
            var txtAbsent = totAbsent + txtType[config.metrique_absences];
        } else {	// Totaux calculés
            var txtJustifie = floatToHour(totaux.justifie);
            var txtAbsent = floatToHour(totaux.absent);
        }

        document.querySelector(".absences>.totauxAbsences").style.display = "grid";
        document.querySelector(".absences>.totauxAbsences").innerHTML = `
            <div class="entete justifie">Nombre justifiées</div>
            <div class="entete absent">Nombre injustifiées</div>
            <div class="entete retard">Nombre retards</div>

            <div>${txtJustifie}</div>
            <div>${txtAbsent}</div>
            <div>${totaux.retard}</div>
        `;
    }
    
}

function getMatiere(data, txt) {
    if(Number.isInteger(txt)) {
        let matiere = Object.entries({...data.relevé.ressources, ...data.relevé.saes}).find(e => {
            return e[1].id == txt;
        });
        if(!matiere) {
            return "-";
        }
        return matiere[0] + ' - ' + matiere[1].titre;
    } else {
        return txt || "-";
    }
}

function floatToHour(heure){
    return Math.floor(heure) + "h"+ ((heure%1*60 < 10)?"0"+Math.round(heure%1*60) : Math.round(heure%1*60))
}
</script>

<!-- <script async src="https://www.googletagmanager.com/gtag/js?id=UA-XXXXXXXXX"></script>
<script>
if(location.hostname != "localhost" && location.hostname != "127.0.0.1"){
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'UA-XXXXXXXX', { 'anonymize_ip': true });
}
</script> -->