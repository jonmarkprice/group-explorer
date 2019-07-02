$(window).on('load', load);	// like onload handler in body

let group;
function load() {
   Library.loadFromURL()
          .then( (_group) => {
             group = _group;
             formatGroup()
          } )
          .catch( console.error );
}

function formatGroup() {
   const $rslt = $(document.createDocumentFragment())
      .append(eval(Template.HTML('header')));
   if (group.isAbelian) {
      $rslt.append(eval(Template.HTML('abelian')));
   } else if (group.isSolvable) {
      let decomposition;
      try {
         decomposition = findSolvableDecomposition(group);
         let decompositionDisplay = decomposition
            .reverse()
            .map( el => makeGroupRef(el) );
         decompositionDisplay.push(makeGroupRef(IsomorphicGroups.map.get(1)[0]));
         decompositionDisplay = decompositionDisplay.reverse().join(' &#x25c5; ');
         $rslt.append(eval(Template.HTML('solvable')));
         for (let i = 0; i < decomposition.length - 1; i++) {
            let g = decomposition[i];
            $rslt.find('#decomposition')
                 .append(eval(Template.HTML('decomposition_element')));
         }
         let g = decomposition[decomposition.length - 1];
         $rslt.find('#decomposition')
              .append(eval(Template.HTML('decomposition_termination')));
      } catch (err) {
         const unknown_subgroup = decomposition.find( (gr) => gr.name === undefined );
         $rslt.append(eval(Template.HTML('failure')));
      }
   } else {
      $rslt.append(eval(Template.HTML('unsolvable')));
      if (group.isSimple) {
         $rslt.append(eval(Template.HTML('simple')));
      }
   }

   $('body').prepend($rslt);
   MathJax.Hub.Queue(['Typeset', MathJax.Hub]);

   $( '.show-decomposition' ).on( 'click', function ( event ) {
      event.preventDefault();
      const type = event.target.getAttribute( 'data-type' );
      showSolvableDecompositionSheet( type );
   } );

   setUpGAPCells();
}

function makeGroupRef(group) {
   const g = (group.name === undefined ? group.isIsomorphicTo : group);
   return `<a href="javascript:Library.openWithGroupURL('GroupInfo.html', '${g.URL}')">${MathML.sans(g.name)}</a>`;
}

// given group, returns sequence of subgroups as BasicGroups
function findSolvableDecomposition(group) {
   if (group.isAbelian) {
      return [group];
   }

   // search subgroups for normal subgroup with Abelian quotient group
   const subgroups = group.subgroups;
   for (let i = 0; i < subgroups.length; i++) {
      const subgroup = subgroups[i];
      if (subgroup.order == 1 || subgroup.order == group.order || !subgroup.isNormal ) {
         continue;
      }

      // check that quotient group is Abelian
      const quotientGroup = group.getQuotientGroup(subgroup.members);
      if (!quotientGroup.isAbelian) {
         continue;
      }

      // convert subgroup to BasicGroup
      const subgroupAsGroup = group.getSubgroupAsGroup(subgroup);
      const decomposition = findSolvableDecomposition(subgroupAsGroup);
      if (decomposition === undefined) {
         throw {subgroupIndex: i};
      } else {
         subgroupAsGroup.isIsomorphicTo = IsomorphicGroups.find(subgroupAsGroup);
         group.subgroupIndex = i;
         group.subgroupIsomorphicTo = subgroupAsGroup.isIsomorphicTo;
         group.quotientIsomorphicTo = IsomorphicGroups.find(quotientGroup);
         decomposition.push(group);
         return decomposition;
      }
   }
   return undefined;
}

// Works very much like the previous function, but includes lots more
// details useful for illustrating the whole thing in a sheet.
// Assumes all groups in library loaded.
function getDetailedSolvableDecomposition ( G ) {
   const Z_1 = Library.getAllLocalGroups().find( gp => gp.order == 1 );
   if ( !G.isSolvable ) {
      return null;
   }
   if ( G.isAbelian ) {
      return [
         {
            group : Z_1
         },
         {
            group : G,
            embeddingFromPrevious : [ 0 ],
            quotientByPrevious : G,
            quotientMap : G.elements.slice()
         }
      ];
   }
   for ( var i = 0 ; i < G.subgroups.length ; i++ ) {
      const H = G.subgroups[i];
      if ( H.order == 1 ) continue;
      if ( H.order == G.order ) continue;
      if ( !G.isNormal( H ) ) continue;
      var pair = IsomorphicGroups.findEmbedding( G, H );
      if ( !pair ) continue;
      const [ N, e ] = pair;
      pair = IsomorphicGroups.findQuotient( G, H );
      if ( !pair ) continue;
      const [ Q, q ] = pair;
      if ( !Q.isAbelian ) continue;
      const D = getDetailedSolvableDecomposition( N );
      if ( !D ) continue;
      D.push( {
         group : G,
         embeddingFromPrevious : e,
         quotientByPrevious : Q,
         quotientMap : q
      } );
      return D;
   }
   console.error( `Warning!  The group ${G.shortName} was not solvable, `
                + 'but this function checked G.isSolvable at the outset!  '
                + 'Something is wrong.' );
   return null;
}

function showSolvableDecompositionSheet ( type ) {
   const D = getDetailedSolvableDecomposition( group );
   if ( !D ) return alert( 'Error computing solvable decomposition' );
   const n = D.length,
         L = 25, T = 175, txtH = 50, W = Math.floor( 600 / n ), H = W,
         hgap = Math.floor( W / 3 ), vgap = 100, bottomShift = vgap/4;
   // create sheet title and description
   var sheetElementsAsJSON = [
      {
         className : 'TextElement',
         text : `Solvable Decomposition for the group ${mathml2text( group.name )}`,
         x : L, y : T - 3*txtH, w : n*W + (n-1)*hgap, h : txtH,
         fontSize : '20pt', alignment : 'center'
      },
      {
         className : 'TextElement',
         text : 'The top row is the solvable decomposition.  '
              + 'The bottom row are abelian quotient groups.',
         x : L, y : T - 2*txtH, w : n*W + (n-1)*hgap, h : txtH,
         alignment : 'center'
      }
   ];
   const red = 'hsl(0, 100%, 80%)';
   const notred = '';
   var previous = null, previousIndex = -1;
   D.map( ( entry, index ) => {
      // put name of group atop each element in top row, the decomposition
      sheetElementsAsJSON.push( {
         className : 'TextElement',
         text : mathml2text( entry.group.name ),
         x : L+index*W+index*hgap, y : T-txtH, w : W, h : txtH,
         alignment : 'center'
      } );
      // put visualizer for each element in top row, the decomposition
      const subgroupElts = entry.embeddingFromPrevious ?
         entry.embeddingFromPrevious.filter( ( value, index, self ) =>
            self.indexOf( value ) === index ) : [ 0 ];
      const subgroupBitSet = new BitSet( entry.group.order, subgroupElts );
      const elementOrder = entry.group.getCosets( subgroupBitSet )
         .map( coset => coset.toArray() )
         .reduce( ( list1, list2 ) => list1.concat( list2 ), [ ] );
      console.log( elementOrder );
      const highlight = elementOrder.map( ( elt, index ) =>
         subgroupBitSet.get( index ) ? red : notred );
      sheetElementsAsJSON.push( {
         className : type, groupURL : entry.group.URL,
         x : L+index*W+index*hgap, y : T, w : W, h : H,
         elements : elementOrder, highlights : { background : highlight }
      } );
      // for every visualizer except the trivial group, add the
      // embedding map, the quotient group, the quotient map, and its name.
      const thisIndex = sheetElementsAsJSON.length - 1;
      if ( previous ) {
         // embedding from previous
         sheetElementsAsJSON.push( {
            className : 'MorphismElement',
            name : mathml2text( `<msub><mi>e</mi><mn>${index}</mn></msub>` ),
            fromIndex : previousIndex, toIndex : thisIndex,
            showManyArrows : true,
            definingPairs : previous.group.generators[0].map( gen =>
               [ gen, entry.embeddingFromPrevious[gen] ] )
         } );
         // quotient group
         sheetElementsAsJSON.push( {
            className : type, groupURL : entry.quotientByPrevious.URL,
            x : L+index*W+index*hgap+bottomShift, y : T+H+vgap,
            w : W, h : H,
            highlights : {
                background : entry.quotientByPrevious.elements.map( ( elt, idx ) => idx ? notred : red )
            }
         } );
         const quotientIndex = sheetElementsAsJSON.length - 1;
         // quotient group name
         sheetElementsAsJSON.push( {
            className : 'TextElement',
            text : mathml2text( entry.group.name ) + ' / '
                 + mathml2text( previous.group.name ) + ' &cong; '
                 + mathml2text( entry.quotientByPrevious.name ),
            x : L+index*W+index*hgap+bottomShift, y : T+2*H+vgap+txtH/2,
            w : W, h : txtH,
            alignment : 'center'
         } );
         // quotient map
         sheetElementsAsJSON.push( {
            className : 'MorphismElement',
            name : mathml2text( `<msub><mi>q</mi><mn>${index}</mn></msub>` ),
            fromIndex : thisIndex, toIndex : quotientIndex,
            showManyArrows : true,
            definingPairs : entry.group.generators[0].map( gen =>
               [ gen, entry.quotientMap[gen] ] )
         } );
      }
      previous = entry;
      previousIndex = thisIndex;
   } );
   CreateNewSheet( sheetElementsAsJSON );
}
