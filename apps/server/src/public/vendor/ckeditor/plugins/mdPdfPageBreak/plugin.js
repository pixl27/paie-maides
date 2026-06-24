CKEDITOR.plugins.add('mdPdfPageBreak',
  {
    init: function( editor )
    {
    //Le code commence ici
    editor.addCommand('mdInsertPdfBreakPage',
      {
        requires : [ 'fakeobjects' ],
        exec: function(editor)
        {
          editor.insertHtml("\n</page><page>\n");
        }
      }
    );
    editor.ui.addButton('mdPdfPageBreak',
      {
        label: 'Maides : Inserer saut de page PDF',
        command: 'mdInsertPdfBreakPage',
        icon: this.path + 'images/page.gif'
      }
    );
    }
  }
);  