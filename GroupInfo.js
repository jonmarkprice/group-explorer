// Global variables
var group;	// group this page displays information about

// Static event managers (setup after document is available)
$(function() {
   $('#Computed_properties + div').on('click', (ev) =>
      ($(ev.target).attr('page') === undefined) ? undefined : Library.openWithGroupURL($(ev.target).attr('page'), group.URL))
});
$(window).on('load', load);	// like onload handler in body

// read in library, group from invocation
function load() {
   Library.loadFromURL()
          .then( (_group) => {
             group = _group;
             displayStatic();
             displayDynamic();
          } )
          .catch( console.error );
}

// displays group information that is independent of the representation
function displayStatic() {
   window.graphicContext = new DisplayDiagram({width: 100, height: 100, fog: false});

   // Header
   $('#heading').html(eval(Template.HTML('heading_template')));

   // Basic facts
   const basicFacts = [
      {groupField: 'order',      displayName: 'Order',      formatter: (val) => MathML.sans('<mn>' + val.toString() + '</mn>') },
      {groupField: 'gapid',      displayName: 'GAP ID',     formatter: (val) => MathML.sans('<mtext>' + val + '</mtext>') },
      {groupField: 'gapname',    displayName: 'GAP name',   formatter: (val) => MathML.sans('<mtext>' + val + '</mtext>') },
      {groupField: 'definition', displayName: 'Definition', formatter: (val) => MathML.sans(val) },
   ];
   for (const basicFact of basicFacts) {
      if (group[basicFact.groupField] == undefined) continue;
      $('#basic-fact-table').append(eval(Template.HTML('basicFact-template')));
   }

   // Views --
   //   Add rows to ViewTable until there are no more Cayley Diagrams (including
   //   the generated one) && no more Symmetry Objects
   for (let inx = 0;
      inx < group.cayleyDiagrams.length + 1 || inx < group.symmetryObjects.length;
      inx++) {
      const $row = $('#ViewTable').append(eval(Template.HTML('view_row_template')))
                                  .children()
                                  .last();

      if (inx < group.cayleyDiagrams.length + 1) {
         const diagramName = (inx == group.cayleyDiagrams.length)
                           ? undefined
                           : group.cayleyDiagrams[inx].name;
         const graphicData = new CayleyDiagram(group, diagramName);
         const img = graphicContext.getImage(graphicData);
         $row.children(':nth-child(1)')
             .addClass('programLink')
             .text(diagramName)
             .on('click', () =>
                Library.openWithGroupURL('CayleyDiagram.html', group.URL, {diagram: diagramName}))
             .prepend(img);
      }

      if (inx == 0) {
         const graphicData = new CycleGraph(group);
         window.cycleGraphContext = new DisplayCycleGraph({height: 100, width: 100});
         const img = cycleGraphContext.getImage(graphicData);
         $row.children(':nth-child(2)')
             .addClass('programLink')
             .text('')
             .on('click', () => Library.openWithGroupURL('CycleDiagram.html', group.URL))
             .prepend(img);
      }

      if (inx == 0) {
         const graphicData = new Multtable(group);
         window.multtableContext = new DisplayMulttable({height: 100, width: 100});
         const img = multtableContext.getImage(graphicData);
         $row.children(':nth-child(3)')
             .addClass('programLink')
             .text('')
             .on('click', () => Library.openWithGroupURL('Multtable.html', group.URL))
             .prepend(img);
      }

      if (inx < group.symmetryObjects.length) {
         const objectName = group.symmetryObjects[inx].name;
         const graphicData = SymmetryObject.generate(group, objectName);
         const img = graphicContext.getImage(graphicData);
         $row.children(':nth-child(4)')
             .addClass('programLink')
             .text(objectName)
             .on('click', () =>
                Library.openWithGroupURL('SymmetryObject.html', group.URL, {diagram: objectName}))
             .prepend(img);
      }
   }

   // Description
   if (group.notes != '') {
      $('#description').html(group.notes);
   }

   // Computed properties:
   $('#computed-properties').prepend(eval(Template.HTML('computedProperties_template')));
   if (group.isCyclic) {
      const [m, n, _] = MathUtils.getFactors(group.order)
                                 .reduce( ([fac1, fac2, prev], el) => {
                                    if (el >= prev) {
                                       fac1 *= el;
                                       prev = el;
                                    } else {
                                       fac2 *= el;
                                    }
                                    return [fac1, fac2, prev];
                                 }, [1, 1, 0] );
      const template_name = (n == 1) ? 'not-Z_mn-row-template' : 'Z_mn-row-template';
      $('#computed-properties tbody').append(eval(Template.HTML(template_name)));
   }

   // File data
   $('#file-data').html(eval(Template.HTML('fileData_template')));
}

// (Re-)paints group information that depends on the representation (which may change)
function displayDynamic() {
   // Generators
   if (group.generators.length != 0) {
      $('#generators').html(displayGenerators());
   }

   // Default element names
   if (group.representation.length != 0) {
      $('#default-element-names').html(MathML.csList(group.elements.map( (el) => group.representation[el] )));
      if (group.representationIndex < group.representations.length) {
         $('#default-element-names').append('<br>This representation was loaded from the group file.');
      } else {
         $('#default-element-names').append('<br>This representation is user-defined; see below.');
      }
   }

   // Loaded element names
   if (group.representations.length > 1 || group.representationIndex > group.representations.length) {
      const fragment = group
         .representations
         .reduce( (frag, rep, index) => {
            if (group.representations[index] != group.representation) {
               const scheme = MathML.rowList(group.elements.map( (el) => group.representation[el] + '<mo>=</mo>' + rep[el] ));
               frag.append(eval(Template.HTML('loadedSchemeChoice-template')));
            }
            return frag;
         }, $('<ol>') );
      $('#loaded-naming-schemes').html(fragment);
   }

   // User-defined naming schemes
   if (group.userRepresentations.length == 0) {
      $('#no-user-defined-naming-schemes').show();
      $('#user-defined-naming-schemes').hide();
   } else {
      $('#no-user-defined-naming-schemes').hide();
      const fragment = group
         .userRepresentations
         .reduce( (frag, rep, index) => {
            if (group.userRepresentations[index] == group.representation) {
               frag.append(eval(Template.HTML('inUseScheme-template')));
            } else {
               const scheme = MathML.rowList(group.elements.map( (el) => group.representation[el] + '<mo>=</mo>' + rep[el] ));
               frag.append(eval(Template.HTML('userSchemeChoice-template')));
            }
            return frag;
         }, $('<ol>') );
      $('#user-defined-naming-schemes').html(fragment).show();
   }

   // notes
   Notes.show();

   setUpGAPCells();

   MathJax.Hub.Queue(['Typeset', MathJax.Hub]);

   $( '.show-all-visualizers-sheet' ).on( 'click', function ( event ) {
      event.preventDefault();
      showAllVisualizersSheet();
   } );
}

function displayClassEquation() {
   if (   group.order > 5
       && group.conjugacyClasses.every( (el) => el.popcount() == 1 )) {
      return `1 + 1 + ... (${group.order} times) ... + 1 = ${group.order}`;
   } else {
      return group.conjugacyClasses
                  .map( (el) => el.popcount() )
                  .join(' + ') +
             ` = ${group.order}`;
   }
}

function displayOrderClasses() {
   return `${(new Set(group.elementOrders)).size} order
           class${(group.order != 1) ? 'es' : ''}`;
}

function displayGenerators() {
   return group.generators.map(
      (gen) => gen.reduce(
         (acc, el, inx) => {
            const rep = MathML.sans(group.representation[el]);
            if (gen.length == 1) {
               return `The element ${rep} generates the group.`;
            } else if (inx == 0) {
               return `The elements ${rep}`;
            } else if (inx == gen.length-1) {
               return acc + ` and ${rep} generate the group.`;
            } else {
               return acc + `, ${rep}`;
            }
         },
         '')
   ).join('<br>');
}

function setRep(index) {
   group.representation = group.representations[index];
   Library.saveGroup(group);
   displayDynamic();
}

class UDR {
   static setRep(index) {
      group.representation = group.userRepresentations[index];
      Library.saveGroup(group);
      displayDynamic();
   }

   static create() {
      UDR.current_index = group.userRepresentations.length;
      UDR._showEditor(Array(group.order).fill('<mtext>change me</mtext>'));
   }

   static edit(index) {
      UDR.current_index = index;
      UDR._showEditor(group.userRepresentations[index]);
   }

   static _showEditor(representation) {
      const editor = $(eval(Template.HTML('namingEditor-template')));
      const tableBody = editor.find('tbody');
      representation.forEach( (rep, inx) => tableBody.append(eval(Template.HTML('udredit-template'))) );
      $('body').append(editor).find('#naming-editor').show();
      MathJax.Hub.Queue(['Typeset', MathJax.Hub, 'naming-editor']);
   }

   static closeEdit() {
      UDR.current_index = undefined;
      $('#naming-editor').remove();
   }

   static saveEdit() {
      group.userRepresentations[UDR.current_index] =
         $('#udredit-table tbody textarea').map( (_, el) => '<mtext>' + el.value + '</mtext>' ).toArray();
      Library.saveGroup(group);
      UDR.closeEdit();
      displayDynamic();
   }

   static remove(index) {
      group.deleteUserRepresentation(index);
      Library.saveGroup(group);
      displayDynamic();
   }
}

class Notes {
   static show() {
      if (group.userNotes == '') {
         $('#notes-content').html('<i>none</i>');
      } else {
         $('#notes-content').text(group.userNotes);
      }
      $('#notes-show').show();
      $('#notes-edit').hide();
   }

   static edit() {
      $('#notes-text').text( (group.userNotes == undefined) ? '' : group.userNotes );
      $('#notes-show').hide();
      $('#notes-edit').show();
   }

   static clear() {
      $('#notes-text')[0].value = '';
   }

   static save() {
      group.userNotes = $('#notes-text')[0].value;
      Library.saveGroup(group);
      Notes.show();
   }
}

function showAllVisualizersSheet () {
   const iso = group.generators[0].map( g => [ g, g ] );
   CreateNewSheet( [
      {
         className : 'TextElement',
         x : 50, y : 50, w : 800, h : 50,
         text : `All Visualizers for the Group ${mathml2text(group.name)}`,
         fontSize : '20pt', alignment : 'center'
      },
      {
         className : 'TextElement',
         x : 50, y : 100, w : 200, h : 50,
         text : `Cayley Diagram`, alignment : 'center'
      },
      {
         className : 'TextElement',
         x : 350, y : 100, w : 200, h : 50,
         text : `Multiplication Table`, alignment : 'center'
      },
      {
         className : 'TextElement',
         x : 650, y : 100, w : 200, h : 50,
         text : `Cycle Graph`, alignment : 'center'
      },
      {
         className : `CDElement`,
         groupURL : group.URL,
         x : 50, y : 150, w : 200, h : 200
      },
      {
         className : `MTElement`,
         groupURL : group.URL,
         x : 350, y : 150, w : 200, h : 200
      },
      {
         className : `CGElement`,
         groupURL : group.URL,
         x : 650, y : 150, w : 200, h : 200
      },
      {
         className : `MorphismElement`,
         fromIndex : 4, toIndex : 5,
         name : mathml2text( '<msub><mi>id</mi><mn>1</mn></msub>' ),
         showInjSurj : true, showManyArrows : true, definingPairs : iso
      },
      {
         className : `MorphismElement`,
         fromIndex : 5, toIndex : 6,
         name : mathml2text( '<msub><mi>id</mi><mn>2</mn></msub>' ),
         showInjSurj : true, showManyArrows : true, definingPairs : iso
      }
   ] );
}
